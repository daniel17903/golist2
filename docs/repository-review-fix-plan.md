# Repository review fix plan

This documents the fix plan produced from a full repository review (functionality
and performance issues found across web state/storage/domain, sharing/sync
frontend+backend, UI components/hooks, and the backend service). Work is split
into 8 medium-sized steps, each scoped to a self-contained set of files so it can
be handed to a single agent.

Status legend: ✅ done · ⬜ not started.

## Step 1 — Backend infra hardening (CORS, logging, server lifecycle, pool, migrations, env) ✅

**Files:** `apps/backend/src/server.ts`, `apps/backend/src/plugins/observability.ts`,
`apps/backend/src/plugins/error-handler.ts`, `apps/backend/src/db/client.ts`,
`apps/backend/src/db/migrate.ts`, `apps/backend/src/config/env.ts`

- Restrict CORS to `https://go-list.app` (plus local dev origins) instead of
  reflecting any origin.
- Remove the dead module-level `buildServer()` instance/default export in
  `server.ts` that nothing imported.
- Redact share tokens (which travel in the URL path) out of logged request URLs.
- Deduplicate request/error logging between Fastify's built-in logger,
  `observability.ts`, and `error-handler.ts`.
- Configure the pg `Pool` with explicit `max`/`idleTimeoutMillis`/
  `connectionTimeoutMillis` for a serverless deployment.
- Serialize migrations with a Postgres advisory lock to close a
  check-then-act race.
- Require explicit DB config in production instead of silently falling back
  to localhost defaults.

Follow-up fix: the initial CORS allowlist used a single fixed local-dev origin
(`http://localhost:5173`), which broke the Playwright E2E suite (it serves the
frontend via Vite preview on a different origin/port). Fixed by matching any
`localhost`/`127.0.0.1` origin regardless of port in non-production.

## Step 2 — Sync query performance (backend) ✅

**Files:** `apps/backend/src/repositories/postgres-list-repository.ts`,
`apps/backend/src/routes/sync-websocket.ts`, `packages/shared/src/domain/sync.ts`,
`apps/backend/src/db/migrations/`

- Added an index matching the existing `listItems` `ORDER BY created_at, id`
  (previously only an `(list_id, updated_at DESC)` index existed, forcing an
  in-memory sort).
- Added a per-list digest/summary cache (`ListSyncCache`) shared between the
  REST and WebSocket sync routes, so repeated `list_digest`/`hash_diff`/
  `subscribe_list` checks against an unchanged list skip re-querying and
  re-hashing. Invalidated on any write to that list.
- Deliberately left out of scope: pruning soft-deleted (`deleted_at`) rows —
  a data-retention decision, not a pure perf fix.

## Step 3 — List-rename tie-break + sync protocol cleanup ✅

**Files:** `apps/web/src/sharing/storeSyncBridge.ts`,
`apps/backend/src/repositories/postgres-list-repository.ts`,
`apps/web/src/sharing/socketSync.ts`, `apps/web/src/state/useStore.ts`,
`docs/websocket-sync-protocol.md`, `docs/frontend-sharing-sync.md`

- List-metadata patches have no deterministic tie-break when `updatedAt`
  ties (item sync does, via a hash comparison) — two offline devices renaming
  the same list to different names can permanently diverge. Apply the same
  style of deterministic tie-break to list-metadata patches on both client
  and server.
- Remove the dead `socketSyncManager.requestResync()` call right after
  `setActiveList()` in `useStore.ts` (it no-ops because `isSubscribedReady`
  is always false at that point).
- Either wire up the unused `serverListDigest` field on the client or remove
  it from the protocol.
- Update the sync protocol docs to match.

**Must run after Step 2** — both touch `postgres-list-repository.ts`.

## Step 4 — Dexie transactional integrity ✅

**File:** `apps/web/src/state/useStore.ts`

- Wrapped `deleteList`'s and `joinSharedList`'s multi-step Dexie writes in
  `db.transaction(...)` so an interrupted app (crash, thrown error) can't
  leave orphaned rows (e.g. items surviving a partial list delete).
- Added rollback tests covering partial-failure cases.

## Step 5 — Store mutation & load performance (investigate-first) ✅

**File:** `apps/web/src/state/useStore.ts`, possibly `apps/web/src/storage/db.ts`

- `mergeItemsById` now patches only changed positions via a lazily-rebuilt
  id→index cache (keyed by array reference, so wholesale replacements
  self-invalidate) instead of `.map()`ing every item in every list;
  `toggleItem`/`updateItem` lookups use the same cache.
- `load()` boots by querying only the active list's items via the indexed
  `listId` Dexie query, renders, then hydrates the remaining history in the
  background. WebSocket sync init is gated on that hydration completing,
  because its full-sync pass reads every list's local items synchronously —
  starting earlier could make an un-hydrated list look empty and let stale
  server data overwrite genuine offline edits.
- Deferred as follow-up: fully decoupling the sync layer from needing
  all-lists items in memory (making `getItemsForList` async with per-list
  Dexie reads at sync time) — it touches the race-sensitive digest fast-path
  in `handleSubscribedMessage` and is a larger, separate refactor.

**Should run after Step 4** — both touch `useStore.ts`.

## Step 6 — UI component/hook fixes ✅

**Files:** `apps/web/src/components/ItemGrid.tsx`,
`apps/web/src/hooks/useAddItemDialog.ts`, `apps/web/src/components/Modal.tsx`,
`apps/web/src/hooks/usePullToRefresh.ts`, `apps/web/src/App.tsx`

- `ItemGrid.tsx` passes a new inline arrow function as `onClick` into every
  `ItemCard` (a `React.memo` component) on every render, defeating its
  memoization — extract it into a stable `useCallback`.
- `useAddItemDialog.ts` never clears `itemName` on dialog close/open, only on
  successful add — dismissing via backdrop click leaves stale text.
- `Modal.tsx` isn't wrapped in `React.memo`, unlike every other file in
  `components/`.
- Fix a `suppressItemPressRef` reset-ordering race between `usePullToRefresh`
  and `App.tsx` that can swallow one tap immediately after an aborted pull
  gesture.

## Step 7 — Domain logic fixes ✅

**Files:** `apps/web/src/domain/relativeTime.ts`,
`packages/shared/src/domain/item-category-mapping.ts`,
`apps/web/src/domain/languageSuggestion.ts`

- `relativeTime.ts` doesn't handle negative elapsed time (future `updatedAt`
  from a clock-skewed peer device) — renders as "now" instead of surfacing
  the anomaly.
- Category/icon resolution does a full linear scan on every keystroke-driven
  add, multiplied by `locales × items` inside `findLanguageSuggestion` — build
  an index/map once at module load instead.

## Suggested execution order

- **Parallel-safe:** Steps 1, 2, 4, 6, 7 (no file overlap between them).
- **Sequential:** Step 2 → Step 3 (both touch `postgres-list-repository.ts`).
- **Run last:** Step 5, after Step 4 lands (both touch `useStore.ts`; Step 5
  is also the highest-risk step and benefits from the codebase being
  otherwise settled).
