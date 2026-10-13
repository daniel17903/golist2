#!/bin/bash
# Claude Code cloud sessions: install deps and wire up the Playwright browser.
# The real work lives in scripts/agent-setup.sh so other agents can use it.
set -euo pipefail

if [ "${CLAUDE_CODE_REMOTE:-}" != "true" ]; then
  exit 0
fi

"$CLAUDE_PROJECT_DIR/scripts/agent-setup.sh" --env-file "${CLAUDE_ENV_FILE:-/dev/null}"
