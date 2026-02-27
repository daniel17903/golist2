# OpenClaw integration assets

This folder contains an OpenClaw skill for managing GoList lists through the backend API.

- `SKILL.md`: operational instructions and constraints for OpenClaw.
- `golist_cli.py`: Python CLI wrapper that executes list creation/join/share/read/item operations.

The skill uses the fixed API base URL `https://go-list.app/api`, generates/persists its own device UUID, generates UUIDs + timestamps for writes, and persists known lists by name/id.

## Quick usage
```bash
python3 apps/openclaw/golist_cli.py create-list "Weekend groceries"
python3 apps/openclaw/golist_cli.py upsert "milk" --quantity "2 L"
python3 apps/openclaw/golist_cli.py share
python3 apps/openclaw/golist_cli.py join <share-token-uuid> --name "Shared with me"
python3 apps/openclaw/golist_cli.py lists
```
