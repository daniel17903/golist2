# Frontend Performance Improvement Plan

Status: In progress
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

---

## Remaining Work

### P0: Memoize `ItemCard` component
**File:** `apps/web/src/components/ItemCard.tsx`
**Effort:** Low

Wrap `ItemCard` with `React.memo`. Currently every item card re-renders when
any grid-level state changes — even if only one item's `isExiting` flag
changed or a toast appeared. With memoization, unchanged cards skip rendering.

```tsx
const ItemCard = React.memo(({ item, isExiting, ... }: ItemCardProps) => {
  return <button>...</button>;
});
ItemCard.displayName = "ItemCard";
export default ItemCard;
```

**Note:** This must be combined with callback stabilization (P1 items below) to
be effective — inline arrow functions in props defeat `React.memo`'s shallow
comparison.

---

### P1: Add `React.memo` to major child components
**Files:**
- `apps/web/src/components/AppHeader.tsx`
- `apps/web/src/components/BottomBar.tsx`
- `apps/web/src/components/ListsDrawer.tsx`
- `apps/web/src/components/ItemGrid.tsx`

**Effort:** Low

Wrap each component's default export with `React.memo`. Since `App` holds
~20+ pieces of local state, any state change re-renders all children. Memoizing
them prevents re-renders when their props haven't changed.

---

### P1: Stabilize callback props with `useCallback`
**File:** `apps/web/src/App.tsx` (lines 505-680)
**Effort:** Medium

Dozens of inline arrow functions are passed as props to child components:
- `onOpenStats={() => setIsListStatsOpen(true)}`
- `onStartRename={() => { ... }}`
- `onOpenDrawer={() => setIsDrawerOpen(true)}`
- 8+ closures for `ListsDrawer`
- Closures for `CreateListModal`, `JoinListModal`

Each creates a new function identity on every render, defeating `React.memo`.
Wrap them in `useCallback`:

```tsx
const handleOpenStats = useCallback(() => setIsListStatsOpen(true), []);
const handleOpenDrawer = useCallback(() => setIsDrawerOpen(true), []);
```

---

### P1: Fix pull-to-refresh effect re-registering every frame
**File:** `apps/web/src/App.tsx` (lines 406-490)
**Effort:** Low

`pullDistance` is in the `useEffect` dependency array. Since it changes on
every `touchmove` event during a pull gesture, the effect tears down and
re-registers event listeners on every frame.

Fix: read `pullDistance` from a ref instead of including it in deps:

```tsx
const pullDistanceRef = useRef(pullDistance);
pullDistanceRef.current = pullDistance;

// Remove pullDistance from the dependency array
useEffect(() => {
  const onTouchEnd = () => {
    const shouldRefresh = pullDistanceRef.current >= pullThreshold && ...;
    // ...
  };
  // ...
}, [handlePointerCancel, isPopupOpen, isPullRefreshing, refreshRealtimeConnection]);
```

---

### P1: Isolate `backendLogs` from triggering app-wide re-renders
**File:** `apps/web/src/state/useStore.ts` (lines 540-546)
**Effort:** Medium

Every `appendBackendLog` call creates a new array, which triggered the old
whole-store subscription. With fine-grained selectors (now done), only
components that select `backendLogs` re-render. However, `App.tsx` still
subscribes via `useAppState` which returns `backendLogs`.

Options:
1. Have the debug panel (`showBackendLogs` block in `App.tsx`) subscribe to
   `backendLogs` directly with its own `useStore` selector, rather than
   receiving it through `useAppState`.
2. Move `backendLogs` to a separate store or `useRef` since it's dev-only.

---

### P1: Stabilize `useLongPressItem` handlers
**File:** `apps/web/src/hooks/useLongPressItem.ts` (lines 35-58)
**Effort:** Low

`handlePointerDown`, `handlePointerUp`, and `handlePointerCancel` are plain
function declarations recreated every render. Since `handlePointerCancel` is
in the pull-to-refresh effect's dependency array, this causes the effect to
re-register unnecessarily.

Wrap them in `useCallback`.

---

### P2: Lazy-load rarely-used modals
**File:** `apps/web/src/App.tsx` (lines 1-14)
**Effort:** Low

Eagerly imported modals that most sessions never open:
- `LegalModal` (197 lines with 3-language legal text)
- `SettingsModal`
- `ListStatsModal`
- `JoinListModal`

Use `React.lazy()` + `Suspense`:

```tsx
const LegalModal = lazy(() => import("./components/LegalModal"));
const SettingsModal = lazy(() => import("./components/SettingsModal"));

// In JSX — only render when open:
{isSettingsModalOpen && (
  <Suspense fallback={null}>
    <SettingsModal isOpen onClose={() => setIsSettingsModalOpen(false)} />
  </Suspense>
)}
```

Also change modal rendering to conditional (`{isOpen && <Modal />}`) instead
of always-mounted (`<Modal isOpen={isOpen} />`), avoiding hook evaluation for
closed modals.

---

### P2: Cache regex in `inputParser.getAmountPattern`
**File:** `apps/web/src/domain/inputParser.ts` (lines 106-109)
**Effort:** Low

`getAmountPattern` constructs a `RegExp` from ~30 unit strings on every call.
It's called on every keystroke in the add-item dialog. Cache per locale:

```tsx
const amountPatternCache = new Map<Locale, RegExp>();

const getAmountPattern = (locale: Locale) => {
  const cached = amountPatternCache.get(locale);
  if (cached) return cached;
  const units = unitByLocale[locale].map(escapeRegExp).join("|");
  const pattern = new RegExp(...);
  amountPatternCache.set(locale, pattern);
  return pattern;
};
```

---

### P2: Merge category and icon lookup into single function
**File:** `packages/shared/src/domain/item-category-mapping.ts` (lines 2684-2716)
**Effort:** Low

`getItemIconName` and `getCategoryIdForItem` each do a full linear scan of
300+ matchers. They're called together on every item add/update. Combine into
one function that returns both `{ category, iconName }`.

---

### P3: Vendor chunk splitting
**File:** `apps/web/vite.config.ts`
**Effort:** Low

Add `manualChunks` for better caching of vendor dependencies:

```tsx
build: {
  rollupOptions: {
    output: {
      manualChunks: {
        vendor: ["react", "react-dom", "zustand", "dexie"],
      },
    },
  },
},
```

---

### P3: Extend PWA precache glob patterns
**File:** `apps/web/vite.config.ts` (line 62)
**Effort:** Low

Currently only images are matched. Add JS/CSS/HTML for reliable offline:

```tsx
globPatterns: ["**/*.{js,css,html,ico,png,svg,jpg,jpeg,webp,gif}"],
```

---

### P3: Delete unused `RenameListModal`
**File:** `apps/web/src/components/RenameListModal.tsx`
**Effort:** Trivial

This component is not imported anywhere — leftover from before inline rename.
Delete it.

---

## Priority Summary

| Priority | Item | Impact | Effort |
|----------|------|--------|--------|
| ~~P0~~ | ~~Zustand fine-grained selectors~~ | ~~Critical~~ | ~~Done~~ |
| P0 | Memoize `ItemCard` | High | Low |
| P1 | `React.memo` on major children | High | Low |
| P1 | Stabilize callbacks with `useCallback` | High | Medium |
| P1 | Fix pull-to-refresh effect deps | Medium | Low |
| P1 | Isolate `backendLogs` rendering | Medium | Medium |
| P1 | Stabilize `useLongPressItem` handlers | Medium | Low |
| P2 | Lazy-load modals | Medium | Low |
| P2 | Cache regex in `inputParser` | Low-Medium | Low |
| P2 | Merge category/icon lookup | Low-Medium | Low |
| P3 | Vendor chunk splitting | Low | Low |
| P3 | Extend PWA precache patterns | Low | Low |
| P3 | Delete unused `RenameListModal` | Trivial | Trivial |
