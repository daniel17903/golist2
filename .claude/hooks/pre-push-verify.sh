#!/bin/bash
# PreToolUse hook (Bash): block `git push` until `npm run verify:changed` passes.
# Exit 0 lets the command run; exit 2 blocks it and shows stderr to the agent.
set -uo pipefail

input="$(cat)"

# Fast path: most Bash calls never mention a push, skip them without parsing.
case "$input" in
  *git*push*) ;;
  *) exit 0 ;;
esac

project_dir="${CLAUDE_PROJECT_DIR:-$(cd "$(dirname "$0")/../.." && pwd)}"

# Decide on the parsed command: `git [global options] push ...`, possibly after
# `cd x &&`, `;` or `|`. Branch deletions (`--delete`, `:branch`) are not checked.
is_push="$(printf '%s' "$input" | node -e '
  let raw = "";
  process.stdin.on("data", (chunk) => (raw += chunk));
  process.stdin.on("end", () => {
    let command = "";
    try {
      command = JSON.parse(raw)?.tool_input?.command ?? "";
    } catch {}
    const push = /(?:^|[\s;&|(])git(?:\s+(?:-C\s+\S+|-c\s+\S+|--?[\w-]+(?:=\S+)?))*\s+push\b([^;&|]*)/.exec(command);
    const deletes = push && /(?:\s--delete\b|\s-d\b|\s:\S)/.test(push[1]);
    process.stdout.write(push && !deletes ? "yes" : "no");
  });
')"

if [ "$is_push" != "yes" ]; then
  exit 0
fi

log_file="$(mktemp -t golist-verify.XXXXXX)"
if (cd "$project_dir" && npm run --silent verify:changed) >"$log_file" 2>&1; then
  rm -f "$log_file"
  exit 0
fi

{
  echo "Push blocked: \`npm run verify:changed\` failed. Fix the failures below, commit, then push again."
  echo "Full output: $log_file"
  echo
  tail -n 40 "$log_file"
} >&2
exit 2
