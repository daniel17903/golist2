---
name: react-performance
description: GoList web app React performance rules (memoization, stable callbacks, Zustand selectors, refs, effect deps, direct-DOM drag frames, popup stack). Use before writing or reviewing any change to apps/web/src/components/, apps/web/src/hooks/ or apps/web/src/App.tsx — new components, modals, props, callbacks, store subscriptions, useEffect/useCallback — even small UI tweaks, since one inline arrow or bare useStore() silently undoes the measured re-render work.
---

# React performance rules (web app)

These rules protect the completed work in `docs/frontend-performance-plan.md`
(read it for the measurements behind them). The common failure is subtle: the
code works, tests pass, but every keystroke, sync frame or drag frame
re-renders the whole app again. Apply the rules to every web-app change and
re-check your diff against the checklist at the end.

## Component memoization

- Every component in `apps/web/src/components/` that receives props from a
  parent is wrapped in `React.memo` — including modals, even though they return
  `null` while closed. New components follow the same pattern, with a named
  function so DevTools and stack traces show the name:
  ```tsx
  const MyComponent = memo(function MyComponent(props: Props) { ... });
  export default MyComponent;
  ```
- Don't remove an existing `memo` wrapper without an explicit, stated reason.

## Callback stability

`memo` only helps if every prop keeps its identity across renders.

- Don't pass inline arrow functions as props to memoized children. Use a
  `useCallback` result, a `useState` setter, or a module-scope function.
  ```tsx
  // Bad — new identity every render, defeats React.memo
  <AppHeader onOpenStats={() => setIsListStatsOpen(true)} />

  // Good — stable reference
  const handleOpenStats = useCallback(() => setIsListStatsOpen(true), []);
  <AppHeader onOpenStats={handleOpenStats} />
  ```
- Inline arrows are fine on plain elements (`<button>`, `<div>`) and in
  `.map()` callbacks that produce plain elements.
- Helper functions declared inside a component that are passed as props or
  appear in `useEffect`/`useCallback` deps must themselves be `useCallback`s.
- Same for object/array props: build them with `useMemo` or at module scope,
  not inline literals.

## Zustand selectors

- Never subscribe to the whole store with a bare `useStore()`; always select a
  slice: `useStore((s) => s.specificSlice)`.
- Store actions are created once in `create()` and are stable. Extract them at
  module scope via `useStore.getState()` instead of selecting them in
  components.
- Patterns: `apps/web/src/hooks/useAppState.ts` (selectors),
  `apps/web/src/hooks/useAddItemDialog.ts` (module-scope actions).
- Subscribe only while needed: e.g. the drawer subscribes to `items` (for its
  "last updated" labels) only while it is shown.

## Refs for frequently-changing values

- When a `useCallback`/`useEffect` needs a value that changes often (`items`,
  `exitingItemIds`, `activeList`), keep it in a ref synced by a no-deps effect
  instead of adding it to the deps:
  ```tsx
  const itemsRef = useRef(items);
  useEffect(() => { itemsRef.current = items; });
  ```
- Never assign `.current` in the render body — the `react-hooks/refs` lint rule
  rejects it.

## Effects and per-frame work

- Keep rapidly-changing values (animation positions, pull distance, drag
  offset) out of `useEffect` deps, or the effect tears down and re-registers
  every frame.
- Per-frame gesture state is written straight to the DOM, not React state:
  pull-to-refresh distance, drawer transform and backdrop opacity. Follow that
  pattern for new gestures.
- Grid animations live in `apps/web/src/hooks/useGridLayoutAnimation.ts` (FLIP
  via the Web Animations API); reuse it rather than adding a second animation
  path.

## Overlays

New modals build on `components/Modal.tsx` and open/close through
`apps/web/src/hooks/usePopupStack.ts`, so the back gesture and "is any popup
open" checks keep working. Don't touch `useBackGestureTrap.ts` without reading
its comments.

## Checklist (run over your diff before committing)

1. New component receiving props from a parent? → `memo(function Name…)`.
2. Function/object passed as a prop? → `useCallback`/`useMemo`, setter, or
   module scope — no inline arrows to memoized children.
3. New Zustand subscription? → slice selector; actions via
   `useStore.getState()` at module scope.
4. New `useEffect`/`useCallback`? → no high-frequency values in deps; use refs
   synced in an effect.
5. New modal/overlay? → `usePopupStack`.

Then `npm run lint -w apps/web` (catches the ref rule and hook deps),
`npm run typecheck -w apps/web`, and — for UI flow changes —
`npm run test:e2e -w apps/web`.
