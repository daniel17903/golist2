# Frontend sharing sync logic

This document explains how the web app (`apps/web`) syncs shared lists with the backend while preserving local-first behavior.

## Goals

- Keep local writes instant and available offline.
- Push user-triggered mutations to backend immediately when possible.
- Avoid blocking app startup or normal UI interactions when backend is slow/unreachable.
- Converge to backend-canonical list/item state after mutations and periodic sync cycles.

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
- item create/update/tombstone -> `PUT /v1/lists/{shareToken}/items/{itemId}`

If backend is unreachable or slow, request timeout/error is swallowed so UX stays local-first.

### 3. Full reconciliation (background)

After immediate push attempt, app triggers full list reconciliation in background (`syncList`):

1. pull remote list snapshot
2. push local list name when local is newer/different
3. push local items missing/older on remote
4. pull final remote snapshot again
5. replace local list+item state for that shared list with final pulled snapshot

This ensures eventual full convergence when backend is reachable.

## Startup and periodic behavior

- On app load, shared-list sync starts in background (`syncAllLists`) and is not awaited.
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
