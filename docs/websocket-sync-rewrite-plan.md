# WebSocket Sync Rewrite Plan

## Goals

- Keep one persistent WebSocket connection from frontend to backend while the app is open.
- Sync only the currently selected list over that socket.
- Stop using frontend HTTP item fetch/put endpoints for list-item synchronization.
- Reconcile updates in both directions without sending the full list on every change.
- Ensure updates created before/while disconnected are synced after reconnect.
- Resolve conflicts with timestamp-based last-write-wins (newer update overwrites older update).
- Retry connection a limited number of times when the socket drops.

## Design Principles (Keep It Simple)

- **Always hash-compare at subscription start**: whenever a client subscribes to a list, both sides compare item hashes first.
- **No mutation log dependency**: reconciliation is driven by current item state + hashes.
- **Minimal metadata**: timestamps are sufficient for ordering; no `version` or `logicalClock` fields.
- **List-scoped only**: protocol and payloads are only for the active list.

## Architecture Overview

1. **Single long-lived socket per app session**
   - Open after app bootstrap/auth/device context is ready.
   - Keep open for app lifetime; close only on app shutdown/logout.

2. **List-scoped subscription**
   - Client sends `subscribe_list` for selected list.
   - On list switch: `unsubscribe_list` then `subscribe_list` for new list.
   - Backend emits events only for subscribed list.

3. **Hash-first delta sync**
   - At start of every subscription, exchange list-level digest and then compact per-item summaries (`id` + `hash`).
   - Derive missing/stale items and exchange only those items.
   - For older/stable ranges, compare bucket hashes first and expand only mismatched buckets to per-item hashes.
   - Bucket policy: one bucket for items older than 3 weeks, one bucket for items older than 1 week (and up to 3 weeks), and per-item hashes for newer items.

## Minimal Data Model

For each item record (both frontend and backend), keep only:

- `itemId`
- `listId`
- item payload fields (name, checked, quantity, etc.)
- `updatedAt` (client-provided timestamp for local edits; server preserves and rebroadcasts)
- `deletedAt` (nullable tombstone timestamp)

Notes:

- Do not add `version` or `logicalClock`.
- Do not persist a mutation log as a requirement for synchronization.
- Keep tombstones indefinitely for now (no pruning policy yet).

## WebSocket Protocol (Draft)

1. `hello`
   - Client -> server: auth/device context.
   - Server -> client: accepted session info.

2. `subscribe_list`
   - Client -> server: `{ listId }`.
   - Server -> client: subscription accepted + `serverListDigest` + request for `clientListDigest` if not provided.

3. `list_digest`
   - Bidirectional: `{ listId, digest }`.
   - If digests match: subscription is in sync.
   - If digests differ: immediately start `hash_diff`.

4. `hash_diff`
   - Bidirectional exchange of compact per-item summary: `itemId`, `itemHash`.
   - Bucket optimization (default):
     - bucket A: all items with `updatedAt` older than 3 weeks
     - bucket B: all items with `updatedAt` older than 1 week and up to 3 weeks
     - newer items: per-item hashes
   - Expand only mismatched buckets to per-item hashes.
   - Each side computes which items are missing/stale.

5. `item_patch`
   - Bidirectional transfer of only required item upserts/deletes after diff.
   - Payload includes full item state for changed items.

6. `ping/pong`
   - Keepalive + dead connection detection.

## Reconciliation Rules

1. **Always hash-compare at subscription start**.
2. For each conflicting item (same `itemId` but different state), choose state with greater `updatedAt`.
3. If `updatedAt` is identical, use deterministic tie-breaker (`itemId` lexical) so both sides converge consistently.
4. Delete vs upsert follows the same rule: newer timestamp wins.
5. Backend remains authoritative for final resolution when conflicts are detected simultaneously.

## Frontend Implementation Plan

1. **Socket lifecycle manager**
   - States: `idle -> connecting -> connected -> reconnecting -> failed`.
   - One socket instance for app lifetime.

2. **Subscription manager**
   - Watch selected list in store.
   - On every `subscribe_list`, run digest + hash diff before considering list synced.

3. **Local outbound queue**
   - Record local item edits/deletes immediately with client `updatedAt`.
   - Optimistically update local DB/UI.
   - Flush queued `item_patch` messages when connected.
   - No explicit ack flow: failed/uncertain sends are retried on next subscription hash-compare sync.

4. **Inbound apply path**
   - Apply incoming item states only if incoming `updatedAt` wins.
   - Recompute digest/hash after apply.

5. **Deprecate HTTP item sync path**
   - Remove frontend HTTP fetch/put item sync calls for normal operation.

## Backend Implementation Plan

1. **WebSocket service**
   - Authenticated endpoint with device context.
   - Connection registry by session and subscribed list.

2. **Digest/hash utilities**
   - Deterministic list digest and per-item hash generation from current stored items.

3. **Subscribe-time reconciliation**
   - Always trigger digest compare and hash diff on new subscription.
   - Request/send only required item patches in both directions.

4. **Realtime fan-out**
   - Accepted item update is broadcast to connected subscribers of that list.

5. **Fallback**
   - If a hash-diff exchange is interrupted, rely on reconnect + next subscription hash-compare to recover.

## Reliability & Reconnect

1. Detect disconnect on close/error/pong timeout.
2. Retry with exponential backoff + jitter for a bounded budget (example: 5 attempts).
3. After retries exhausted, pause until online/foreground/manual retry trigger.
4. On reconnect, resubscribe and run digest/hash compare again.

## Rollout Plan

1. **Phase 1**: add backend socket endpoint + digest/hash compare protocol behind flag.
2. **Phase 2**: enable WebSocket sync path in frontend while monitoring convergence.
3. **Phase 3**: remove frontend HTTP item sync fetch/put path.
4. **Phase 4**: harden retries, observability, and fallback behavior.

## Testing Plan

1. **Unit**
   - Digest/hash determinism.
   - Timestamp ordering and tie-break behavior.

2. **Integration**
   - Subscribe -> hash compare -> targeted patch exchange.
   - Offline changes on both sides -> reconnect -> convergence.
   - Reconnect after drop -> bounded retries -> successful catch-up.

3. **E2E**
   - Two clients editing same list concurrently.
   - List switch with single persistent socket.
   - Network drop/recovery while app remains open.

## Observability

- Metrics:
  - active sockets,
  - reconnect attempts/success,
  - sync lag,
  - hash-diff mismatch rate.
- Logs:
  - subscribe events,
  - digest mismatch events,
  - hash diff sizes,
  - conflict resolutions.

## Open Decisions

1. Canonical hash algorithm and payload normalization rules.
2. Whether to show explicit UI state after reconnect budget is exhausted.
