# Frontend sharing sync logic

This document explains how the web app (`apps/web`) syncs shared lists with the backend while preserving local-first behavior.

## Goals

- Keep local writes instant and available offline.
- Maintain one long-lived WebSocket connection for realtime synchronization while the app is open.
- Sync only the currently active list over that socket.
- Reconcile with digest/hash exchange and targeted patches instead of full-list transfers on every mutation.
- Converge deterministically with last-write-wins (`updatedAt`) and stable hash tie-breaks.

## Configuration

The frontend reads backend sync configuration at build time (in `apps/web/vite.config.ts`):

- `API_BASE_URL`: backend base URL used for list/share-token HTTP endpoints and WebSocket URL derivation.
- `API_TIMEOUT_MS`: per-request timeout in milliseconds (defaults to `15000`).
- `ENVIRONMENT`: deployment environment string used for debug UI gating (defaults to `development`).

## Sync model

### 1. Local-first mutations

For list/item mutations, the app writes to IndexedDB and updates Zustand state first.

### 2. WebSocket lifecycle

- One `SocketSyncManager` is initialized after app metadata/device context is loaded.
- Socket URL is derived from `API_BASE_URL` (`http -> ws`, `https -> wss`) and targets `/v1/ws`.
- Connection state is surfaced as `unknown` / `online` / `offline`.
- Reconnect retries 3 times with a 3s delay, then continues retrying every 10s indefinitely.

### 3. Active-list subscription

- Only one list is subscribed at a time; outside the full sync pass that is the active list.
- On list switch the client sends `unsubscribe_list` (old) then `subscribe_list` (new).
- Outbound item and list-metadata patches are queued and flushed only after the subscription is acknowledged.

### 4. Full sync pass after (re)connecting

Because the outbound patch queue lives in memory, changes made offline must not depend on it — they may
target lists other than the active one, or the app may have been restarted before reconnecting. To cover
this, every (re)connect triggers one reconciliation pass over **all** locally known lists:

1. The active list is subscribed and reconciled first.
2. Each remaining local list is subscribed in turn, reconciled via the digest/hash-diff exchange below,
   then the client advances (an 8s per-list timeout prevents stalls).
3. The client re-subscribes the active list when the pass completes.
4. Lists the backend does not know yet (created while offline) are registered once via
   `PUT /v1/lists/{listId}` when the subscription is rejected with `forbidden`, then retried; lists that
   remain inaccessible are skipped so the rest of the pass still runs.
5. On `subscribed`, the client compares the server's list name/`updatedAt` with the local copy and pushes
   a `list_metadata_patch` when the local rename is newer (so offline renames survive app restarts).

### 5. Reconciliation protocol

On subscription and manual resync:

1. Client and server exchange `list_digest` values (the server also pushes its `hash_diff` summaries
   unsolicited right after acknowledging a subscription).
2. On mismatch, both sides exchange per-item `hash_diff` summaries (`itemId`, `itemHash`, `updatedAt`).
3. Each side computes missing/stale items and exchanges targeted `item_patch` payloads.
4. Incoming items are applied only when their `updatedAt` wins; equal timestamps use deterministic hash tie-break.

Protocol details are documented in `docs/websocket-sync-protocol.md` and mirrored in `apps/api-spec/openapi.yaml` under `/v1/ws`.

## HTTP usage boundaries

- HTTP remains used for list/share-token operations (`PUT /v1/lists/{listId}`, `GET /v1/lists/{listId}`, share-token create/redeem).
- Item synchronization does **not** use item HTTP endpoints (`/v1/lists/{listId}/items...`) in frontend sync flow.

## Failure handling

- WebSocket disconnects are non-fatal; local mutations remain in IndexedDB and are retried by subsequent reconciliation.
- Sync errors are surfaced as notices/logs in non-production environments.
