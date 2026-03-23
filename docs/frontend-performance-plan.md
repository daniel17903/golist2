# Frontend Performance Improvement Plan

Status: Complete
Last updated: 2026-03-23

## Completed

### P0: Fine-grained Zustand selectors in `useAppState`
**File:** `apps/web/src/hooks/useAppState.ts`

Replaced the single whole-store `useStore()` call with individual selectors
(`useStore((s) => s.lists)`, etc.) and extracted stable action references to
module scope via `useStore.getState()`.

**Impact:** Previously, every Zustand state change (including `backendLogs`
appending on each sync request, `backendBusyRequests` toggling) triggered a
full re-render of `App` and every child component. Now each selector only
triggers a re-render when its specific slice changes.

### P0: Memoize `ItemCard` component
**File:** `apps/web/src/components/ItemCard.tsx`

Wrapped `ItemCard` with `React.memo` using a named function for better DevTools
display. Unchanged cards now skip rendering when grid-level state changes
(e.g. toast appearance, other items' `isExiting` flags).

**Note:** Full benefit requires callback stabilization (P1) to avoid inline
arrow functions defeating the shallow comparison.

### P1: Add `React.memo` to major child components
**Files:**
- `apps/web/src/components/AppHeader.tsx`
- `apps/web/src/components/BottomBar.tsx`
- `apps/web/src/components/ListsDrawer.tsx`
- `apps/web/src/components/ItemGrid.tsx`

Wrapped each component with `React.memo` using named functions. Since `App`
holds ~20+ pieces of local state, any state change previously re-rendered all
children. Memoizing prevents re-renders when their props haven't changed.

### P1: Stabilize callback props with `useCallback`
**File:** `apps/web/src/App.tsx`

Replaced ~25 inline arrow function props with stable `useCallback` references.
This covers all callback props passed to memoized children: `AppHeader`,
`BottomBar`, `ItemGrid`, `ListsDrawer`, `AddItemDialog`, `CreateListModal`,
`JoinListModal`, `SettingsModal`, `LegalModal`, `EditItemModal`, and
`LanguageSuggestionModal`.

Also stabilized internal helper functions (`clearUndoTimeout`,
`clearAppToastTimeout`, `removeUndoToast`, `removeAppToast`,
`enqueueUndoToast`, `pushAppToast`, `showUndoDelete`, `showUndoRename`,
`shareWithSystemSheet`, `handleUndoDelete`, `handleUndoRename`,
`handleToggleItem`, `handleExitComplete`) with `useCallback`, and moved
frequently-changing values (`exitingItemIds`, `items`, `activeList`) to refs
synced via `useEffect` to avoid unnecessary dependency churn.

### P1: Fix pull-to-refresh effect re-registering every frame
**File:** `apps/web/src/App.tsx`

Moved `pullDistance` reads to a ref (`pullDistanceRef`) synced via `useEffect`
and removed `pullDistance` from the touch-event `useEffect` dependency array.
Previously the effect tore down and re-registered `touchstart`/`touchmove`/
`touchend` listeners on every `touchmove` frame during a pull gesture.

### P1: Isolate `backendLogs` from triggering app-wide re-renders
**Files:**
- `apps/web/src/components/BackendLogPanel.tsx` (new)
- `apps/web/src/hooks/useAppState.ts`
- `apps/web/src/App.tsx`

Extracted the backend-log panel and sync-notice toast into a dedicated
`BackendLogPanel` component that subscribes directly to `backendLogs` and
`syncNotice` via fine-grained Zustand selectors. Removed both subscriptions
from `useAppState`, so `backendLogs` appends no longer cause `App` or any of
its children to re-render.

### P1: Stabilize `useLongPressItem` handlers
**File:** `apps/web/src/hooks/useLongPressItem.ts`

Wrapped `handlePointerDown`, `handlePointerUp`, and `handlePointerCancel` with
`useCallback`. Stored `onLongPress`, `onShortPress`, and `delay` props in refs
synced via `useEffect` so the callbacks have stable identities. This prevents
the pull-to-refresh effect (which depends on `handlePointerCancel`) from
re-registering on every render.

### P2: Lazy-load rarely-used modals
**File:** `apps/web/src/App.tsx`

Converted `LegalModal`, `SettingsModal`, `ListStatsModal`, and `JoinListModal`
from eager imports to `React.lazy()` with `<Suspense fallback={null}>`.
Changed rendering from always-mounted (`<Modal isOpen={isOpen} />`) to
conditional (`{isOpen && <Suspense><Modal isOpen /></Suspense>}`), avoiding
hook evaluation for closed modals and deferring code loading until first open.

### P2: Cache regex in `inputParser.getAmountPattern`
**File:** `apps/web/src/domain/inputParser.ts`

Added a `Map<Locale, RegExp>` cache so the ~30-unit regex is compiled once per
locale instead of on every keystroke in the add-item dialog.

### P2: Merge category and icon lookup into single function
**Files:**
- `packages/shared/src/domain/item-category-mapping.ts`
- `apps/web/src/domain/categories.ts`
- `apps/web/src/state/useStore.ts`

Added `getCategoryAndIconForItemName` that resolves both category and icon name
in a single pass through the matcher list. Updated `addItem` and `updateItem`
in the store to use the combined function, halving matcher scans on item
create/update.

### P3: Vendor chunk splitting
**File:** `apps/web/vite.config.ts`

Added `manualChunks` to split `react`, `react-dom`, `zustand`, and `dexie`
into a separate `vendor` chunk for better long-term caching.

### P3: Extend PWA precache glob patterns
**File:** `apps/web/vite.config.ts`

Extended workbox `globPatterns` to include `js`, `css`, and `html` files
alongside images, ensuring reliable offline support for all static assets.

### P3: Delete unused `RenameListModal`
**File:** `apps/web/src/components/RenameListModal.tsx` (deleted)

Removed the unused component, which was a leftover from before inline rename
was implemented.

---

## Priority Summary

| Priority | Item | Impact | Status |
|----------|------|--------|--------|
| ~~P0~~ | ~~Zustand fine-grained selectors~~ | ~~Critical~~ | ~~Done~~ |
| ~~P0~~ | ~~Memoize `ItemCard`~~ | ~~High~~ | ~~Done~~ |
| ~~P1~~ | ~~`React.memo` on major children~~ | ~~High~~ | ~~Done~~ |
| ~~P1~~ | ~~Stabilize callbacks with `useCallback`~~ | ~~High~~ | ~~Done~~ |
| ~~P1~~ | ~~Fix pull-to-refresh effect deps~~ | ~~Medium~~ | ~~Done~~ |
| ~~P1~~ | ~~Isolate `backendLogs` rendering~~ | ~~Medium~~ | ~~Done~~ |
| ~~P1~~ | ~~Stabilize `useLongPressItem` handlers~~ | ~~Medium~~ | ~~Done~~ |
| ~~P2~~ | ~~Lazy-load modals~~ | ~~Medium~~ | ~~Done~~ |
| ~~P2~~ | ~~Cache regex in `inputParser`~~ | ~~Low-Medium~~ | ~~Done~~ |
| ~~P2~~ | ~~Merge category/icon lookup~~ | ~~Low-Medium~~ | ~~Done~~ |
| ~~P3~~ | ~~Vendor chunk splitting~~ | ~~Low~~ | ~~Done~~ |
| ~~P3~~ | ~~Extend PWA precache patterns~~ | ~~Low~~ | ~~Done~~ |
| ~~P3~~ | ~~Delete unused `RenameListModal`~~ | ~~Trivial~~ | ~~Done~~ |
