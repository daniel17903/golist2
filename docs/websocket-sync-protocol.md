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
- `ping`
  - `{ "type": "ping" }`

### Server -> client

- `hello_ack`
  - `{ "type": "hello_ack" }`
- `subscribed`
  - `{ "type": "subscribed", "listId": "<uuid>", "serverListDigest": "<string>" }`
- `hash_diff`
  - same shape as client `hash_diff`
- `item_patch`
  - same shape as client `item_patch`
- `pong`
  - `{ "type": "pong" }`
- `error`
  - `{ "type": "error", "message": "<string>" }`

## Reconciliation and conflict resolution

1. Client must send `hello` before other operations.
2. Reconciliation starts with digest comparison; hash-diff exchange follows when digests differ.
3. `item_patch` carries full item state deltas only for missing/stale records.
4. Last-write-wins by `updatedAt`.
5. If `updatedAt` is equal, both sides use deterministic item-hash tie-break to guarantee convergence.

## Scope

- Realtime sync is active-list scoped: one subscribed list per client connection.
- Item fan-out broadcasts target only sockets currently subscribed to the same list.
