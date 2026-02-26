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
6. OpenClaw must not send `iconName` or `category` unless the caller explicitly provides those exact values.
7. Every request must include the `X-Device-Id` header.

## Runtime inputs and persisted state
Required runtime input:
- `GOLIST_SHARE_TOKEN` (UUID share token for the target list)

Persisted state managed by the skill/runtime:
- `GOLIST_DEVICE_ID` (generated once with a random UUID and reused as `X-Device-Id`)
- `GOLIST_LIST_ID` (set after token redemption)

## Bootstrap flow
Run this once before handling user commands:

1. If `GOLIST_DEVICE_ID` is missing, generate `crypto.randomUUID()` and persist it.
2. Redeem token via `POST https://go-list.app/api/v1/share-tokens/{shareToken}/redeem` using `GOLIST_SHARE_TOKEN` and header `X-Device-Id: {GOLIST_DEVICE_ID}`.
3. Persist `listId` response as `GOLIST_LIST_ID`.
4. All future operations in this session must use only this `listId` and device id.

## API usage
Use `Authorization: Bearer <token>` when available in your OpenClaw runtime.

### 1) Read current list
`GET https://go-list.app/api/v1/lists/{listId}`

Response includes list metadata and items.

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

## Intent mapping for OpenClaw
- “show my list / what is on my list” → fetch list and return non-deleted items.
- “add X” → upsert a new item with `name = X`, `deleted = false`.
- “rename A to B” → find item `A`, upsert same `itemId` with `name = B`, `deleted = false`.
- “remove X” → soft-delete matching item by setting `deleted = true`.

## Safety behavior
- If device id is missing, generate and persist it before any API call.
- If list id is missing, redeem token first.
- If token redemption fails, return a clear auth/share error.
- If asked to access another list, refuse and explain this skill is single-list scoped.
- If icon/category mapping is requested implicitly, ignore mapping and only persist names unless explicit values are provided.
