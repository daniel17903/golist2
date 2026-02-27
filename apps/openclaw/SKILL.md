# GoList Shared-List Manager (OpenClaw Skill)

## Purpose
Enable OpenClaw to manage GoList lists through the backend API, including:
- switching between known lists,
- creating new lists,
- optionally joining lists with a share token.

This skill supports:
- creating a list,
- redeeming a share token,
- reading a selected list,
- upserting list items in the selected list,
- soft-deleting items in the selected list.

## Hard constraints
1. API base URL is fixed to `https://go-list.app/api` and must never be overridden.
2. OpenClaw must generate its own random device UUID and persist it for reuse.
3. OpenClaw must never attempt icon/category inference or mapping.
4. When creating or renaming items, OpenClaw must only upsert the user-provided `name` and required fields.
5. OpenClaw must not send `iconName` or `category` unless the caller explicitly provides those exact values.
6. Every request must include the `X-Device-Id` header.
7. OpenClaw must keep an offline registry of known lists, including each list's `listId` and latest known `name`.

## Runtime inputs and persisted state
Optional runtime input:
- `GOLIST_SHARE_TOKEN` (UUID share token used to initially join a shared list)

Persisted state managed by the skill/runtime:
- `GOLIST_DEVICE_ID` (generated once with a random UUID and reused as `X-Device-Id`)
- `GOLIST_ACTIVE_LIST_ID` (currently selected list)
- `GOLIST_KNOWN_LISTS` (offline map from `listId -> { name }` for list switching)

## Bootstrap flow
Run this before handling user commands:

1. If `GOLIST_DEVICE_ID` is missing, generate `crypto.randomUUID()` and persist it.
2. If `GOLIST_SHARE_TOKEN` is configured, redeem via `POST https://go-list.app/api/v1/share-tokens/{shareToken}/redeem` with header `X-Device-Id: {GOLIST_DEVICE_ID}`.
3. On successful redemption, persist returned `listId` as `GOLIST_ACTIVE_LIST_ID` and ensure it exists in `GOLIST_KNOWN_LISTS`.
4. If no share token is configured, continue without redemption and wait for either list creation, explicit list selection, or an explicit share-token join command.

## List management

### Create a new list
`PUT https://go-list.app/api/v1/lists/{listId}` with body:

```json
{
  "name": "Groceries"
}
```

Rules:
- Generate `listId` with a random UUID.
- After create succeeds, set `GOLIST_ACTIVE_LIST_ID` to the new `listId`.
- Save `{ listId, name }` in `GOLIST_KNOWN_LISTS`.
- Immediately create a share token for that list (see endpoint below) and provide the full share link to the user in this format:
  - `https://go-list.app/?shareToken=<shareToken>`

### Join a list via share token (optional)
`POST https://go-list.app/api/v1/share-tokens/{shareToken}/redeem`

Rules:
- Set `GOLIST_ACTIVE_LIST_ID` from the response.
- Fetch the list details and cache its current name in `GOLIST_KNOWN_LISTS`.

### Switch active list
Rules:
- Only switch to a list id already present in `GOLIST_KNOWN_LISTS`.
- Update `GOLIST_ACTIVE_LIST_ID` when switching.
- If the user references a known list by name, resolve against cached names.
- If no match exists, ask for list id or share token to add the list.

## API usage
Use `Authorization: Bearer <token>` when available in your OpenClaw runtime.

### 1) Read current list
`GET https://go-list.app/api/v1/lists/{listId}` where `listId = GOLIST_ACTIVE_LIST_ID`

Response includes list metadata and items.

After reading, refresh cached list name in `GOLIST_KNOWN_LISTS`.

### 2) Upsert item
`PUT https://go-list.app/api/v1/lists/{listId}/items/{itemId}`

Request body:

```json
{
  "name": "milk",
  "deleted": false,
  "updatedAt": "2026-01-01T12:00:00.000Z"
}
```

Rules:
- `itemId` should be stable for updates and random UUID for new items.
- `updatedAt` must be an ISO timestamp.
- Do not include `iconName` or `category` unless explicitly given by user/operator.

### 3) Soft-delete item
`PUT https://go-list.app/api/v1/lists/{listId}/items/{itemId}` with:

```json
{
  "name": "existing item name",
  "deleted": true,
  "updatedAt": "2026-01-01T12:00:00.000Z"
}
```

### 4) Optional incremental sync
`GET https://go-list.app/api/v1/lists/{listId}/items?updatedAfter=<ISO_TIMESTAMP>`

### 5) Create share token for active list
`POST https://go-list.app/api/v1/lists/{listId}/share-tokens`

Response includes `shareToken`. Return `https://go-list.app/?shareToken=<shareToken>` to the user.

## Intent mapping for OpenClaw
- “show my list / what is on my list” → fetch list and return non-deleted items.
- “switch to list X” → resolve X from `GOLIST_KNOWN_LISTS`, set active list, then confirm.
- “create a new list called X” → create list, cache it, switch active list, and return the share link.
- “add X” → upsert a new item with `name = X`, `deleted = false`.
- “rename A to B” → find item `A`, upsert same `itemId` with `name = B`, `deleted = false`.
- “remove X” → soft-delete matching item by setting `deleted = true`.

## Safety behavior
- If device id is missing, generate and persist it before any API call.
- If active list id is missing, ask user to create a list or provide/share a token.
- If token redemption fails, return a clear auth/share error.
- If switching fails because list is unknown, explain that only cached offline lists can be switched to until a new list is created or joined.
- If icon/category mapping is requested implicitly, ignore mapping and only persist names unless explicit values are provided.
