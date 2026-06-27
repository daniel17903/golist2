# Agent notes for GoList PWA

## Repository layout (monorepo)
- `apps/web/` contains the existing React + TypeScript + Vite PWA.
- `apps/backend/` contains a Fastify + TypeScript backend scaffold with env validation, a `/health` endpoint, and local Docker Compose config (`apps/backend/docker-compose.yml`).
- `packages/shared/` contains shared domain code that can be reused by web and backend (currently shared types).
- Root `package.json` is a workspace manifest; run workspace commands with `-w apps/web` or `-w apps/backend`, or use root aliases like `npm run dev:web` and `npm run dev:backend`.

## Project snapshot (web app)
- **Stack**: React + TypeScript + Vite, Dexie (IndexedDB), Zustand, Vite PWA plugin.
- **Entry points**: `apps/web/index.html`, `apps/web/src/main.tsx`, `apps/web/src/App.tsx` (a thin composition layer — behavior lives in hooks).
- **State + storage**: `apps/web/src/state/useStore.ts` (Zustand) + `apps/web/src/storage/db.ts` (Dexie).
- **Backend sharing/sync**: `apps/web/src/sharing/` — `apiClient.ts` (REST client), `socketSync.ts` (WebSocket realtime sync manager), `storeSyncBridge.ts` (wires incoming sync data into the store). Protocol details in `docs/websocket-sync-protocol.md` and `docs/frontend-sharing-sync.md`.
- **i18n**: `apps/web/src/i18n/` — locale resolution (`resolveLocale.ts`), translations (`resources.ts`), `useI18n()`/module-level `t()`. Language auto-suggestion logic lives in `apps/web/src/domain/languageSuggestion.ts`.
- **Domain logic**: `apps/web/src/domain/` (categories, sorting, input parsing, list stats) plus shared types in `packages/shared/src/domain/types.ts`.
- **UI composition**: `apps/web/src/components/` (shared UI building blocks, including the `Modal.tsx` scaffold all dialogs build on) + `apps/web/src/hooks/` (one hook per feature: popup stack, toasts, dialogs, pull-to-refresh, back-gesture trap, item exit animation, share flow, app bootstrap).
- **Styling**: `apps/web/src/styles.css`.
- **localStorage keys**: `golist.deviceId`, `golist.selectedListId`, plus the i18n keys defined in `apps/web/src/i18n/config.ts`.

## Quickstart
- Requires Node `>= 24` (see `engines` in the root `package.json`).
- `npm install`
- `npm run dev:web` (runs web app dev server from root, default http://localhost:5173)
- Direct web command equivalent: `npm run dev -w apps/web`
- Root aliases exist for all common web/backend scripts: `lint:web`, `typecheck:web`, `test:web`, `test:e2e:web`, `build:web` and the `:backend` equivalents.

## Key behaviors
- Backend sharing auth: protected sharing endpoints require an `X-Device-Id` header and a prior token redemption record for that device/token pair.
- **Multi-list** support with a list selector and inline rename.
- **Item sorting** by grocery category order, fallback to created order.
- **Item suggestions** are **list-specific**, ranked by frequency then recency.
- **Realtime sync**: lists sync over a WebSocket (`/v1/ws`) using hash-diff reconciliation; offline changes are reconciled per list after reconnect. See `docs/websocket-sync-protocol.md` before touching `apps/web/src/sharing/socketSync.ts`.
- **i18n**: en/de/es with locale auto-detection and a one-time language-switch suggestion based on recently added item names.
- **Undo toasts** for item deletion and list rename (max 3 stacked, 5s timeout).
- **Pull-to-refresh** forces a WebSocket reconnect; the pull distance is written straight to the DOM to avoid per-frame re-renders.
- **Back-gesture trap**: a history sentinel keeps the Android/Firefox back gesture inside the PWA and closes the topmost popup instead. Do not touch `apps/web/src/hooks/useBackGestureTrap.ts` without reading its comments — the behavior encodes hard-won Firefox/Fenix quirks.
- **Popup layering**: all overlays register in `apps/web/src/hooks/usePopupStack.ts`; the stack order is the open order and drives both "is any popup open" checks and back-gesture close order. New modals must open/close through the popup stack.

## UX rules (high-level)
- Keep list rename inline with minimal friction (no full-screen modals).
- Preserve item ordering behavior unless the change explicitly targets sorting.
- Suggestions must remain list-scoped and prioritize frequency then recency.

## Development commands
- `npm install`
- `npm run dev:web`
- `npm run lint -w apps/web`
- `npm run typecheck -w apps/web`
- `npm run build -w apps/web`
- `npm run test -w apps/web`
- `npm run db:migrate -w apps/backend`
- `npm run db:seed -w apps/backend`

## CI/CD
- GitHub Actions `ci.yml` workflow validates `lint`, `typecheck`, `test` and `build` for the web workspace on PRs.
- GitHub Actions `backend-bootstrap.yml` runs backend `lint` + `typecheck` + `db:migrate` + `test` (against ephemeral Postgres) on PRs that touch `apps/backend/**`.
- Deploy workflow builds on `main`.

## Testing expectations
- Always run `npm run typecheck -w apps/web` for web changes and `npm run typecheck -w apps/backend` for backend changes before commit.
- Always run `npm run lint -w apps/web` for web changes and `npm run lint -w apps/backend` for backend changes before commit.
- Run `npm run test -w apps/web` for changes to `apps/web/src/domain/`, `apps/web/src/state/`, or `apps/web/src/storage/`.
- Run `npm run test -w apps/backend` for backend endpoint/config changes.
- Run `npm run db:migrate -w apps/backend` for backend schema/migration changes.
- Run `npm run build -w apps/web` for changes that touch PWA assets or build config; run `npm run build -w apps/backend` when backend runtime/build config changes.

## PWA assets
- `apps/web/public/favicon.svg`.
- PWA manifest configured in `apps/web/vite.config.ts`.

## Item icons (`apps/web/public/icons/`)
- All item icons are **512×512 SVGs** with the Adobe Illustrator export header
  (`<svg version="1.1" ... width="512px" height="512px" viewBox="0 0 512 512" ...>`).
  Match this header and the `512x512` size exactly for new icons.
- **Visual style**: black, hand-drawn line-art (outline drawings, not filled
  silhouettes). Every file defines a `.st0` CSS class:
  `fill:none; stroke:#000000; stroke-width:30; stroke-linecap:round;
  stroke-linejoin:round; stroke-miterlimit:10;`.
  The stock icons render their outlines as filled double-contour `<path>`s, but
  authoring new icons as **stroked paths using `class="st0"`** produces a
  visually consistent result and is far easier to hand-author. Use a thinner
  companion class (e.g. `.st1` with `stroke-width:18`) for fine details like
  feathery fronds so they don't read as chunky as the main `30`px outline.
- **NEVER verify an icon's appearance yourself** — there is no SVG renderer
  available locally (`rsvg-convert`, `inkscape`, `sharp`, `cairosvg` are all
  absent), and you must not spin up a browser/screenshot to judge whether an
  icon "looks right". Author the SVG, then **ask the user to confirm it looks
  correct**. Only the user judges visual correctness.
- Adding the SVG file alone does **not** wire the icon to any item. You **must**
  also add the icon to `packages/shared/src/domain/item-category-mapping.ts` so
  item names resolve to it. That file has one `CategoryEntry[]` array per
  supported language (`categoryEntriesDe`, `categoryEntriesEn`,
  `categoryEntriesEs`). Add an entry — `{ assetFileName, matchingNames, category }`
  with `assetFileName` set to the new SVG's base filename — to **every** language
  array, keeping the `category` the same across all languages and translating
  only the `matchingNames` (e.g. fennel → de `fenchel`, en `fennel`, es `hinojo`,
  all `fruitsVegetables`). If you are unsure which `category` to use or which item
  names should map to the icon, **ask the user** instead of guessing.
- After editing the mapping, run `npm run typecheck -w apps/web` (the web app
  consumes the shared package; `packages/shared` has no standalone typecheck
  script).

## Storage/migrations
- Dexie schema lives in `apps/web/src/storage/db.ts`. Keep migrations backward-compatible.

## Common pitfalls
- The PWA service worker can cache aggressively; use hard refresh or clear site data
  when debugging PWA changes.

- Playwright E2E in fresh containers may require both browser binaries and OS deps.
  Run `npx playwright install chromium` and `npx playwright install-deps chromium`
  before running `npm run test:e2e -w apps/web` (or root alias `npm run test:e2e:web`),
  which already sets `RUN_PLAYWRIGHT_E2E=1`.
  For E2E-related changes, do this setup and run the Playwright E2E command before committing.
  Do **not** treat a skipped run as sufficient validation: for E2E-related changes the
  tests must actually execute (the default `npm run test` skips them).

## React performance rules (web app)

These rules exist to prevent regressions against the (completed) work tracked
in `docs/frontend-performance-plan.md`. Follow them for every web-app change.

### Component memoization
- All components in `apps/web/src/components/` that receive props from `App`
  are wrapped with `React.memo` — including modals, even though they return
  `null` while closed. **New components** that receive props from a parent
  must also be wrapped with `React.memo` using a named function:
  ```tsx
  const MyComponent = memo(function MyComponent(props: Props) { ... });
  ```
- Never remove an existing `React.memo` wrapper without an explicit reason.

### Callback stability
- **Never pass inline arrow functions** as props to memoized children. Every
  callback prop must be a stable reference — either a `useCallback` result, a
  state setter from `useState`, or a module-scope function.
  ```tsx
  // Bad — new identity every render, defeats React.memo
  <AppHeader onOpenStats={() => setIsListStatsOpen(true)} />

  // Good — stable reference
  const handleOpenStats = useCallback(() => setIsListStatsOpen(true), []);
  <AppHeader onOpenStats={handleOpenStats} />
  ```
- Inline arrows are acceptable **only** inside elements that are not memoized
  components (e.g. plain `<button>`, `<div>`), or in `.map()` callbacks that
  produce plain elements.
- Helper functions declared inside a component that are passed as props or
  appear in `useEffect`/`useCallback` dependency arrays must themselves be
  wrapped with `useCallback`.

### Zustand selectors
- **Never subscribe to the whole store** with a bare `useStore()` call. Always
  use a fine-grained selector: `useStore((s) => s.specificSlice)`.
- Store actions are stable (created once in `create()`). Extract them at module
  scope via `useStore.getState()` — do not select them inside components.
- See `apps/web/src/hooks/useAppState.ts` (selectors) and
  `apps/web/src/hooks/useAddItemDialog.ts` (module-scope action extraction)
  for the established pattern.

### Refs for frequently-changing values
- When a `useCallback` or `useEffect` needs to read a value that changes often
  (e.g. `items`, `exitingItemIds`, `activeList`), store it in a ref synced via
  a no-deps `useEffect` instead of adding it to the dependency array:
  ```tsx
  const itemsRef = useRef(items);
  useEffect(() => { itemsRef.current = items; });
  ```
- **Never assign to `.current` directly in the render body** — the
  `react-hooks/refs` lint rule will reject it. Always use `useEffect`.

### useEffect dependency hygiene
- Avoid putting rapidly-changing values (e.g. animation frame positions, pull
  distances) in `useEffect` dependency arrays. Use refs instead to prevent
  effect teardown/re-registration on every frame.

### General checklist for new UI code
1. New component receives props from a parent? → wrap with `React.memo`.
2. Passing a function as a prop? → ensure it is wrapped in `useCallback` (or
   is a state setter / module-scope constant).
3. Adding a new Zustand subscription? → use a selector, not the whole store.
4. Adding a `useEffect`? → verify no high-frequency values in the dep array.
5. Adding a modal/overlay? → open and close it through `usePopupStack` so the
   back gesture and "popup open" checks keep working.
6. `docs/frontend-performance-plan.md` (status: complete) documents why these
   rules exist and what was measured.


## Documentation maintenance
- Keep `docs/sharing-plan.md` up to date when backend sharing architecture, sequencing, or CI expectations change.
- Keep `docs/websocket-sync-protocol.md` and `docs/frontend-sharing-sync.md` up to date when the realtime sync protocol or the frontend sync flow changes.
- Keep this `AGENTS.md` file up to date when repo layout, commands, workflows, or testing expectations change. `CLAUDE.md` is just a pointer to this file — keep all content here.
- For backend-sharing related PRs, include doc updates as part of the definition of done when behavior or process changes.

## Production API
- **Base URL**: `https://go-list.app/api/` (not just `/v1/`)
- **Health endpoint**: `https://go-list.app/api/health` returns `{"status":"ok"}`
- **CORS requirement**: API calls from scripts/tools must include `Origin: https://go-list.app` header, otherwise the server returns 500 errors.
- **Share token redemption flow**:
  1. POST to `/api/v1/share-tokens/{shareToken}/redeem` with `x-device-id` (UUID) and `Origin: https://go-list.app` headers
  2. Response: `{"listId": "..."}`
  3. GET `/api/v1/lists/{listId}` with same headers to fetch list data
- **Default category**: Items that don't match any known category mapping are assigned `"other"`. This is the fallback in `apps/web/src/state/useStore.ts`: `category: resolvedCategory ?? "other"`.

## Tooling note
- Use the Context7 MCP server for quick library/API references when needed.
- When introducing new tools or dependencies, always use the latest stable version.
- Never use dependency tags like `@latest` in scripts, workflows, or install commands; always pin an explicit version.
- For backend ID creation, always generate IDs with random UUIDs (for example `crypto.randomUUID()`).
