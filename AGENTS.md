# Agent notes for GoList PWA

## Repository layout (monorepo)
- `apps/web/` contains the existing React + TypeScript + Vite PWA.
- `apps/backend/` contains a Fastify + TypeScript backend scaffold with env validation, a `/health` endpoint, and local Docker Compose config (`apps/backend/docker-compose.yml`).
- `packages/shared/` contains shared domain code that can be reused by web and backend (currently shared types).
- Root `package.json` is a workspace manifest; run workspace commands with `-w apps/web` or `-w apps/backend`, or use root aliases like `npm run dev:web` and `npm run dev:backend`.

## Project snapshot (web app)
- **Stack**: React + TypeScript + Vite, Dexie (IndexedDB), Zustand, Vite PWA plugin.
- **Entry points**: `apps/web/index.html`, `apps/web/src/main.tsx`, `apps/web/src/App.tsx`.
- **State + storage**: `apps/web/src/state/useStore.ts` (Zustand) + `apps/web/src/storage/db.ts` (Dexie).
- **Domain logic**: `apps/web/src/domain/` (categories, sorting) plus shared types in `packages/shared/src/domain/types.ts`.
- **UI composition**: `apps/web/src/components/` (shared UI building blocks) + `apps/web/src/hooks/` (UI state/behavior).
- **Styling**: `apps/web/src/styles.css`.

## Quickstart
- `npm install`
- `npm run dev:web` (runs web app dev server from root, default http://localhost:5173)
- Direct web command equivalent: `npm run dev -w apps/web`

## Key behaviors
- Backend sharing auth: protected sharing endpoints require an `X-Device-Id` header and a prior token redemption record for that device/token pair.
- **Multi-list** support with a list selector and inline rename.
- **Item sorting** by grocery category order, fallback to created order.
- **Item suggestions** are **list-specific**, ranked by frequency then recency.

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

## Storage/migrations
- Dexie schema lives in `apps/web/src/storage/db.ts`. Keep migrations backward-compatible.

## Common pitfalls
- The PWA service worker can cache aggressively; use hard refresh or clear site data
  when debugging PWA changes.

- Playwright E2E in fresh containers may require both browser binaries and OS deps.
  Run `npx playwright install chromium` and `npx playwright install-deps chromium`
  before running `RUN_PLAYWRIGHT_E2E=1 npm run test -w apps/web -- src/e2e.backend-frontend.playwright.test.ts`.
  For E2E-related changes, do this setup and run the Playwright E2E command before committing.
  Do **not** treat a skipped run as sufficient validation: for E2E-related changes you must execute with `RUN_PLAYWRIGHT_E2E=1` so tests actually run.

## React performance rules (web app)

These rules exist to prevent regressions against the work tracked in
`docs/frontend-performance-plan.md`. Follow them for every web-app change.

### Component memoization
- All components in `apps/web/src/components/` that receive props from `App`
  are wrapped with `React.memo`. **New components** that receive props from a
  parent must also be wrapped with `React.memo` using a named function:
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
- See `apps/web/src/hooks/useAppState.ts` for the established pattern.

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
5. Consult `docs/frontend-performance-plan.md` for remaining items and context.


## Documentation maintenance
- Keep `docs/sharing-plan.md` up to date when backend sharing architecture, sequencing, or CI expectations change.
- Keep this `AGENTS.md` file up to date when repo layout, commands, workflows, or testing expectations change.
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
