# WebSocket sync protocol (`/v1/ws`)

This document defines the list-scoped realtime sync protocol used by GoList web and backend.

## Transport

- Endpoint: `GET /v1/ws`
- Protocol: WebSocket
- Authentication context: client sends `hello` with `deviceId` first.

## Message ordering

The server handles each socket's messages strictly in arrival order (one at a
time), even though handlers await the database. A client may therefore send
`subscribe_list` followed immediately by patches for that list without waiting
for `subscribed`, and an `unsubscribe_list`/`subscribe_list` pair can never let
a patch in between be rejected with `not subscribed to list`.

Messages that reached the server before the client disconnected are still
processed (a rename sent right before the app closes is stored and broadcast
to the other subscribers), including writes queued behind a `subscribe_list`
that was still in progress. Only replies to the gone socket are dropped, and
the gone socket is never registered for broadcasts.

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
  - `{ "type": "list_metadata_patch", "listId": "<uuid>", "name": "<string>", "listType": "shopping" | "todo", "updatedAt": <number> }`
  - `listType` is optional for clients that predate list types; when it is missing the server keeps the stored type.

### Server -> client

- `hello_ack`
  - `{ "type": "hello_ack" }`
- `subscribed`
  - `{ "type": "subscribed", "listId": "<uuid>", "listName": "<string>", "listType": "shopping" | "todo", "listUpdatedAt": <number>, "serverListDigest": "<string>" }`
  - `serverListDigest` is the same item digest computed for `list_digest`/`hash_diff`
    (see `buildListDigest` in `packages/shared/src/domain/sync.ts`). The client
    compares it against its own local digest for the list as a fast path. If
    they match, the immediately following `hash_diff` is used only as the
    ordered completion signal after list metadata reconciliation; if they
    differ, the client performs the normal hash-diff exchange below.
- `hash_diff`
  - same shape as client `hash_diff`
- `item_patch`
  - same shape as client `item_patch`
- `list_metadata_patch`
  - `{ "type": "list_metadata_patch", "listId": "<uuid>", "name": "<string>", "listType": "shopping" | "todo", "updatedAt": <number> }`
  - always carries the stored `listType`, also when the client patch omitted it. An accepted
    patch without `listType` (a list stored before list types existed) is also echoed to its
    sender with the stored type, so that device learns a type switched on another device.
- `error`
  - `{ "type": "error", "message": "<string>" }`

### Item state and list types

`<item-state>` is the full item: `id`, `listId`, `name`, `iconName`, `quantityOrUnit?`,
`category`, `deleted`, `createdAt`, `updatedAt`, plus the optional todo fields
`description`, `points`, `completedAt`, `dueDate`, `assignedTo` and `recurrence`
(timestamps in epoch millis). Shopping and todo lists share the same items and the
same sync; the list type (`shopping` | `todo`, part of the list metadata) only
changes how the app shows and checks off entries. Todo fields are optional on every
item and survive a type switch. An `item_patch` carries the complete item, so a todo
field missing from it is cleared.

The item hash (`buildItemHash`) serializes the todo fields only when they are set, so
an item without them hashes exactly as before todo lists existed — stored items and
older clients keep agreeing with the server.

## Reconciliation and conflict resolution

1. Client must send `hello` before other operations.
2. Reconciliation starts with digest comparison; hash-diff exchange follows when digests differ.
3. `item_patch` carries full item state deltas only for missing/stale records.
4. Last-write-wins by `updatedAt`.
5. If `updatedAt` is equal, both sides use deterministic item-hash tie-break to guarantee convergence.
6. Every item inside an `item_patch` must carry the same `listId` as the
   enclosing message. The server validates the complete batch before writing,
   persists the batch in one transaction, and echoes canonical persisted item
   records to every subscribed socket, including the sender. This canonicalizes
   server-owned fields such as `createdAt`. Items in the batch that *lose*
   last-write-wins are not broadcast, but the server sends the stored (winning)
   version back to the sender only (when it differs), so the sender cannot keep
   showing its losing write until the next reconnect.
7. `list_metadata_patch` (rename) uses the same last-write-wins-by-`updatedAt` rule. If
   `updatedAt` ties, the lexicographically greater `name` wins deterministically on every
   peer — client and both backend list repositories (Postgres and in-memory) apply the
   identical rule via the shared `shouldAcceptListMetadata` helper
   (`packages/shared/src/domain/sync.ts`), so two devices renaming the same list to
   different names within the same millisecond still converge on one final name
   regardless of which patch arrives first. The list type is part of the same metadata
   record: if `updatedAt` and `name` both tie, the greater `listType` wins (`todo` over
   `shopping`; a missing type counts as `shopping`).

   A `list_metadata_patch` that loses only because the stored metadata is
   already identical (same name and `updatedAt` — the web client sends every
   rename over REST *and* the socket, and REST can land first) is still
   broadcast to the other subscribers, since the REST route does not notify
   them. A `list_metadata_patch` that loses to *different* stored metadata is
   answered with a `list_metadata_patch` carrying the stored name/type/`updatedAt`,
   sent to the sender only.

8. Clients timestamp a local edit with `max(now, updatedAt of the edited version + 1)`,
   so an edit always supersedes the version it was based on even when the
   editing device's clock is behind the device that wrote that version.
   Incoming items and renames are re-checked against the persisted record
   inside the client's IndexedDB write transaction, so a local edit persisted
   while an incoming change is being applied is never overwritten by it.
   Items use the shared `shouldAcceptItem` rule.

9. List-name conflict resolution uses its own persisted metadata timestamp.
   Item activity may advance the aggregate list activity timestamp, but it
   cannot make an unchanged server-side name defeat an offline rename.

## Scope

- Realtime sync is active-list scoped: one subscribed list per client connection.
- Item fan-out broadcasts target only sockets currently subscribed to the same list.
- Writes made through the MCP server (`docs/mcp-server.md`) are broadcast the same way: accepted items as an
  `item_patch` with the stored versions, renames as a `list_metadata_patch` (the subscriber registry lives in
  `apps/backend/src/sync/list-broadcaster.ts`). REST writes are still not broadcast.
