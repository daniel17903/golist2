#!/usr/bin/env bash
# Prepares a fresh (agent) container so lint, typecheck, unit/sim tests and
# the Playwright E2E suite run without manual setup. Idempotent.
#
# Usage: scripts/agent-setup.sh [--env-file <path>]
#   --env-file  append `export VAR=...` lines for discovered settings
#               (the Claude Code SessionStart hook passes $CLAUDE_ENV_FILE).
#               Without it, the exports are printed so you can eval them.
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
env_file=""
if [[ "${1:-}" == "--env-file" ]]; then
  env_file="${2:-}"
fi

log() { echo "[agent-setup] $*" >&2; }
emit_env() {
  if [[ -n "$env_file" ]]; then
    echo "export $1=\"$2\"" >> "$env_file"
  else
    echo "export $1=\"$2\""
  fi
}

cd "$repo_root"

node_major="$(node -p 'process.versions.node.split(".")[0]')"
if (( node_major < 24 )); then
  log "warning: Node $(node -v) is older than the required >=24 (package.json engines); things usually still work."
fi

# `npm install` (not `npm ci`) so a cached container state is reused.
if [[ ! -d node_modules || package-lock.json -nt node_modules/.package-lock.json ]]; then
  log "installing npm dependencies"
  npm install --no-audit --no-fund >&2
else
  log "npm dependencies up to date"
fi

# --- Playwright browser -----------------------------------------------------
# The pinned Playwright expects one Chromium build; containers often ship a
# different one under $PLAYWRIGHT_BROWSERS_PATH. Use the expected build when
# present, otherwise point the suite at any installed Chromium.
browsers_dir="${PLAYWRIGHT_BROWSERS_PATH:-$HOME/.cache/ms-playwright}"
expected_rev="$(node -e '
  const fs = require("node:fs");
  const path = require("node:path");
  const file = path.join(path.dirname(require.resolve("playwright-core")), "browsers.json");
  const entry = JSON.parse(fs.readFileSync(file, "utf8")).browsers.find((b) => b.name === "chromium");
  process.stdout.write(entry ? entry.revision : "");
')"

if [[ -n "$expected_rev" && ( -d "$browsers_dir/chromium_headless_shell-$expected_rev" || -d "$browsers_dir/chromium-$expected_rev" ) ]]; then
  log "Playwright Chromium $expected_rev is installed"
else
  fallback="$(ls -d "$browsers_dir"/chromium-*/chrome-linux*/chrome 2>/dev/null | sort -V | tail -n 1 || true)"
  if [[ -n "$fallback" ]]; then
    log "Playwright wants Chromium $expected_rev; using preinstalled $fallback"
    emit_env PLAYWRIGHT_CHROMIUM_EXECUTABLE "$fallback"
  else
    log "no Chromium found; run: npx playwright install chromium && npx playwright install-deps chromium"
  fi
fi

# --- Postgres -----------------------------------------------------------------
if [[ -n "${PGHOST:-}${DATABASE_URL:-}" ]]; then
  log "Postgres configured via PGHOST/DATABASE_URL"
elif command -v pg_ctl >/dev/null 2>&1 || ls /usr/lib/postgresql/*/bin/pg_ctl >/dev/null 2>&1; then
  log "Postgres binaries available: run 'eval \"\$(scripts/local-postgres.sh)\"' to start a throwaway database"
  log "(enables backend repository tests and E2E_BACKEND=postgres)"
else
  log "Postgres not available: repository tests skip; E2E_BACKEND=postgres cannot run"
fi

log "done. Fast check: npm run verify   (see AGENTS.md > Testing playbook)"
