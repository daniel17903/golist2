# OpenClaw integration assets

This folder contains an OpenClaw skill for managing one GoList shared list through the backend API.

- `SKILL.md`: operational instructions and constraints for OpenClaw.
- `golist_cli.py`: Python CLI wrapper that executes all required API calls for token redemption, list reads, item upserts, and soft deletes.

The skill is intentionally single-list scoped, uses the fixed API base URL `https://go-list.app/api`, generates/persists its own device UUID, and avoids optional metadata mapping by default.

## Quick usage
```bash
export GOLIST_SHARE_TOKEN="<share-token-uuid>"
python3 apps/openclaw/golist_cli.py bootstrap
python3 apps/openclaw/golist_cli.py show
python3 apps/openclaw/golist_cli.py upsert "milk" --quantity-or-unit "2 L" --language "en"
```
