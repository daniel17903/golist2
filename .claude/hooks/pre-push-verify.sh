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

# Pushes that only delete remote branches are not checked; the rules (heredocs,
# quoted text, several commands in one call) live in is-git-push.mjs.
is_push="$(printf '%s' "$input" | node "$(dirname "$0")/is-git-push.mjs")"

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
