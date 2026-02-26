# Frontend sharing sync logic

This document explains how the web app (`apps/web`) syncs shared lists with the backend while preserving local-first behavior.

## Goals

- Keep local writes instant and available offline.
- Push user-triggered mutations to backend immediately when possible.
- Avoid blocking app startup or normal UI interactions when backend is slow/unreachable.
- Converge to backend-canonical list/item state after mutations, periodic sync cycles, and realtime list-update signals.

## Configuration

The frontend reads backend sync configuration at build time (in `apps/web/vite.config.ts`):

- `API_BASE_URL`: backend base URL used by sharing API client.
- `API_TIMEOUT_MS`: per-request timeout in milliseconds (defaults to `15000`).
- `ENVIRONMENT`: deployment environment string used for debug UI gating (defaults to `development`).

These values are compiled into frontend constants:

- `__API_BASE_URL__`
- `__API_TIMEOUT_MS__`
- `__ENVIRONMENT__`

## Sync stages

### 1. Immediate local write (always)

For list/item mutations, the app first writes to IndexedDB and updates in-memory Zustand state.

### 2. Immediate mutation push (best-effort)

After local write, the app attempts immediate backend push for the changed entity when a share token exists:

- list name changes -> `PUT /v1/lists`
- item create/update/tombstone -> `PUT /v1/lists/{listId}/items/{itemId}`

If backend is unreachable or slow, request timeout/error is swallowed so UX stays local-first.

### 3. Incremental reconciliation (background)

After immediate push attempt, app triggers list reconciliation in background (`syncList`) without re-fetching the full item set:

1. pull remote list metadata snapshot (`GET /v1/lists/:listId`)
2. push local list name when local is newer/different
3. read `lastSyncedAt` for that list from IndexedDB (`listShares`)
4. push only local items updated since `lastSyncedAt`
5. fetch only remote item deltas with `GET /v1/lists/:listId/items?updatedAfter=<ISO timestamp>`
6. merge fetched remote deltas into local IndexedDB/state
7. persist a new `lastSyncedAt` timestamp on successful completion

This keeps convergence behavior while avoiding full list-item downloads on every sync cycle.

## Startup, selected-list realtime, and periodic behavior

- On app load, the app first runs sync for the currently selected list.
- After that initial selected-list sync succeeds, frontend opens a websocket connection to `/v1/lists/{listId}/realtime?deviceId=...`.
- This websocket remains open while the app is in use for the selected list; switching selected list rebinds the connection to the newly selected list.
- If websocket disconnects unexpectedly, frontend retries reconnect a few times with short backoff.
- Both sides can emit a `list-updated` signal on that channel; when frontend receives it from another device it immediately triggers `syncList` for the selected list.
- In parallel, shared-list sync still starts in background (`syncAllLists`) and is not awaited.
- Periodic/lifecycle triggers continue to run in app state hook:
  - interval-based sync
  - on `visibilitychange` back to foreground
  - on `online`

## Failure handling

- API client uses `AbortController` timeout per request.
- Sync errors are non-fatal to preserve local-first UX.
- Local changes remain in IndexedDB and are retried by later sync attempts.

## Error surfacing and connection indicator

- Frontend tracks backend connectivity as `unknown` / `online` / `offline` and surfaces this via a small header indicator icon.
- Sync errors publish a toast message when `ENVIRONMENT` is not `production`.
- When `ENVIRONMENT` is not `production`, the UI includes a backend log panel with all backend call outcomes (success, error, timeout) and skipped-call reasons.
- Toast and backend log visibility are controlled by the compiled `__ENVIRONMENT__` constant.


## Local sync cursor (lastSyncedAt)

The frontend stores per-list sync metadata in IndexedDB table `listShares`:

- `listId`
- `lastSyncedAt` (epoch milliseconds)

`lastSyncedAt` is updated after a successful incremental sync and is reused on the next sync to compute both:

- which local items to push, and
- which remote items to pull via `updatedAfter`.

On first sync (no cursor), the frontend uses an initial timestamp baseline and then records `lastSyncedAt` after the sync succeeds.
