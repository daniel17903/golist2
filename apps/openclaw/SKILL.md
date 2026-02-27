# GoList Shared-List Manager (OpenClaw Skill)

## Purpose
Enable OpenClaw to manage **exactly one** GoList list that has been shared with it through a share token.

This skill supports:
- redeeming one share token,
- reading the shared list,
- upserting list items in that list,
- soft-deleting items in that list.

It does **not** support multiple lists in one session.

## Hard constraints
1. OpenClaw must only interact with a single list id per configured session.
2. API base URL is fixed to `https://go-list.app/api` and must never be overridden.
3. OpenClaw must generate its own random device UUID and persist it for reuse.
4. OpenClaw must never attempt icon/category inference or mapping.
5. When creating or renaming items, OpenClaw must only upsert the user-provided `name` and required fields.
6. OpenClaw must not send optional fields (`iconName`, `category`, `quantityOrUnit`, `language`) unless the caller explicitly provides those exact values.
7. Every request must include the `X-Device-Id` header.

## Python CLI tool
Use `apps/openclaw/golist_cli.py` as the operational API wrapper for this skill.

### CLI guarantees
- Fixed API base URL: `https://go-list.app/api`.
- Generates and persists device id when missing.
- Redeems and persists a single list id.
- Automatically sends `X-Device-Id` on every request.
- Includes optional fields (`iconName`, `category`, `quantityOrUnit`, `language`) only when explicitly passed via CLI flags.

### CLI state and environment
Required runtime input:
- `GOLIST_SHARE_TOKEN` (UUID share token for first bootstrap)

Optional environment:
- `GOLIST_DEVICE_ID` (override persisted device id)
- `OPENCLAW_STATE_FILE` (custom path for persisted JSON state)

Persisted state file (default):
- `~/.openclaw_golist_state.json` with `device_id` and `list_id`

## Bootstrap flow
Run this once before handling user commands:

1. If device id is missing, CLI generates a random UUID and persists it.
2. Redeem token via `POST https://go-list.app/api/v1/share-tokens/{shareToken}/redeem` using `GOLIST_SHARE_TOKEN` and header `X-Device-Id: {deviceId}`.
3. Persist `listId` response.
4. All future operations in this session must use only this `listId` and device id.

CLI command:

```bash
python3 apps/openclaw/golist_cli.py bootstrap
```

## API operations via CLI
### 1) Read current list
```bash
python3 apps/openclaw/golist_cli.py show
```
Returns list metadata and non-deleted items.

### 2) Upsert item
```bash
python3 apps/openclaw/golist_cli.py upsert "milk" [--item-id <uuid>] [--icon-name <icon>] [--category <category>] [--quantity-or-unit <value>] [--language <code>]
```

Rules:
- `itemId` should be stable for updates and random UUID for new items.
- `updatedAt` is generated as an ISO timestamp.
- Do not pass optional field flags unless explicitly requested by caller (`--icon-name`, `--category`, `--quantity-or-unit`, `--language`).

### 3) Soft-delete item
```bash
python3 apps/openclaw/golist_cli.py delete <item-id> "existing item name"
```

### 4) Optional incremental sync
```bash
python3 apps/openclaw/golist_cli.py sync <ISO_TIMESTAMP>
```

## Intent mapping for OpenClaw
- “show my list / what is on my list” → run `show` and return non-deleted items.
- “add X” → run `upsert "X"`.
- “rename A to B” → find item `A`, then run `upsert "B" --item-id <existing-id>`.
- “remove X” → find item `X`, then run `delete <item-id> "X"`.

## Safety behavior
- If device id is missing, generate and persist it before any API call.
- If list id is missing, redeem token first.
- If token redemption fails, return a clear auth/share error.
- If asked to access another list, refuse and explain this skill is single-list scoped.
- If metadata mapping is requested implicitly, ignore mapping and only persist names unless explicit optional values are provided.
