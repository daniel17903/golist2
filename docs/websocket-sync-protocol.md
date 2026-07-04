# WebSocket sync protocol (`/v1/ws`)

This document defines the list-scoped realtime sync protocol used by GoList web and backend.

## Transport

- Endpoint: `GET /v1/ws`
- Protocol: WebSocket
- Authentication context: client sends `hello` with `deviceId` first.

## Message types

### Client -> server

- `hello`
  - `{ "type": "hello", "deviceId": "<uuid>" }`
- `subscribe_list`
  - `{ "type": "subscribe_list", "listId": "<uuid>" }`
- `unsubscribe_list`
  - `{ "type": "unsubscribe_list", "listId": "<uuid>" }`
- `list_digest`
  - `{ "type": "list_digest", "listId": "<uuid>", "digest": "<string>" }`
- `hash_diff`
  - `{ "type": "hash_diff", "listId": "<uuid>", "summaries": [{ "itemId": "<uuid>", "itemHash": "<string>", "updatedAt": <number> }] }`
- `item_patch`
  - `{ "type": "item_patch", "listId": "<uuid>", "items": [<item-state>] }`
- `list_metadata_patch`
  - `{ "type": "list_metadata_patch", "listId": "<uuid>", "name": "<string>", "updatedAt": <number> }`

### Server -> client

- `hello_ack`
  - `{ "type": "hello_ack" }`
- `subscribed`
  - `{ "type": "subscribed", "listId": "<uuid>", "listName": "<string>", "listUpdatedAt": <number>, "serverListDigest": "<string>" }`
  - `serverListDigest` is the same item digest computed for `list_digest`/`hash_diff`
    (see `buildListDigest` in `packages/shared/src/domain/sync.ts`). The client
    compares it against its own local digest for the list as a fast path: if
    they match, items are already reconciled and the client skips waiting
    for/processing the `hash_diff` the server sends immediately afterward; if
    they differ, the client proceeds with the normal hash-diff exchange below.
- `hash_diff`
  - same shape as client `hash_diff`
- `item_patch`
  - same shape as client `item_patch`
- `list_metadata_patch`
  - `{ "type": "list_metadata_patch", "listId": "<uuid>", "name": "<string>", "updatedAt": <number> }`
- `error`
  - `{ "type": "error", "message": "<string>" }`

## Reconciliation and conflict resolution

1. Client must send `hello` before other operations.
2. Reconciliation starts with digest comparison; hash-diff exchange follows when digests differ.
3. `item_patch` carries full item state deltas only for missing/stale records.
4. Last-write-wins by `updatedAt`.
5. If `updatedAt` is equal, both sides use deterministic item-hash tie-break to guarantee convergence.
6. `list_metadata_patch` (rename) uses the same last-write-wins-by-`updatedAt` rule. If
   `updatedAt` ties, the lexicographically greater `name` wins deterministically on every
   peer — client and both backend list repositories (Postgres and in-memory) apply the
   identical rule via the shared `shouldAcceptListMetadata` helper
   (`packages/shared/src/domain/sync.ts`), so two devices renaming the same list to
   different names within the same millisecond still converge on one final name
   regardless of which patch arrives first.

## Scope

- Realtime sync is active-list scoped: one subscribed list per client connection.
- Item fan-out broadcasts target only sockets currently subscribed to the same list.
