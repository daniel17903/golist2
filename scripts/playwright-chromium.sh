#!/usr/bin/env bash
# Prints the Chromium executable the E2E suite should use via
# PLAYWRIGHT_CHROMIUM_EXECUTABLE, or nothing when the build the pinned
# Playwright expects is installed (or no Chromium exists at all).
# Exit code: 0 = expected build present or fallback printed, 1 = no Chromium.
# Used by agent-setup.sh and the pre-push hook (hooks don't inherit the
# session env file that agent-setup.sh writes).
set -uo pipefail

repo_root="$(cd "$(dirname "$0")/.." && pwd)"
browsers_dir="${PLAYWRIGHT_BROWSERS_PATH:-$HOME/.cache/ms-playwright}"
expected_rev="$(cd "$repo_root" && node -e '
  const fs = require("node:fs");
  const path = require("node:path");
  const file = path.join(path.dirname(require.resolve("playwright-core")), "browsers.json");
  const entry = JSON.parse(fs.readFileSync(file, "utf8")).browsers.find((b) => b.name === "chromium");
  process.stdout.write(entry ? entry.revision : "");
' 2>/dev/null)"

# The suite runs headless without a `channel`, so Playwright launches the
# headless shell; a full Chromium build of the expected revision alone is not
# enough and is handled by the fallback below.
if [[ -n "$expected_rev" && -d "$browsers_dir/chromium_headless_shell-$expected_rev" ]]; then
  exit 0
fi

# Prefer a full Chromium build, fall back to a headless-shell-only install.
fallback="$(ls -d "$browsers_dir"/chromium-*/chrome-linux*/chrome 2>/dev/null | sort -V | tail -n 1 || true)"
if [[ -z "$fallback" ]]; then
  fallback="$(ls -d "$browsers_dir"/chromium_headless_shell-*/chrome-*/chrome-headless-shell 2>/dev/null | sort -V | tail -n 1 || true)"
fi
[[ -n "$fallback" ]] || exit 1
echo "$fallback"
