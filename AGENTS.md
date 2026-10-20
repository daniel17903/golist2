# Agent notes for GoList PWA

## Repository layout (monorepo)
- `apps/web/` contains the existing React + TypeScript + Vite PWA.
- `apps/backend/` contains a Fastify + TypeScript backend scaffold with env validation, a `/health` endpoint, and local Docker Compose config (`apps/backend/docker-compose.yml`).
- `packages/shared/` contains shared domain code that can be reused by web and backend (currently shared types).
- `apps/web/sim/` is the in-process multi-device sync simulation (real web store + sync client against the real backend); see `apps/web/sim/README.md`.
- `scripts/` holds repo tooling: `agent-setup.sh` (container setup, also run by the Claude Code SessionStart hook in `.claude/`), `local-postgres.sh` (throwaway local database), `verify.mjs` (runs the right checks).
- `.claude/hooks/` holds Claude Code hooks: `session-start.sh` (runs `agent-setup.sh` in cloud sessions) and `pre-push-verify.sh` (a PreToolUse hook that blocks `git push` until `npm run verify:changed` passes; push detection in `is-git-push.mjs`, tested by `node --test .claude/hooks/is-git-push.test.mjs`). The hook is **not registered in `.claude/settings.json` yet**, so it does not run.
- Root `package.json` is a workspace manifest; run workspace commands with `-w apps/web` or `-w apps/backend`, or use root aliases like `npm run dev:web` and `npm run dev:backend`.

## Project snapshot (web app)
- **Stack**: React + TypeScript + Vite, Dexie (IndexedDB), Zustand, Vite PWA plugin.
- **Entry points**: `apps/web/index.html`, `apps/web/src/main.tsx`, `apps/web/src/App.tsx` (the root component, ~450 lines: calls the feature hooks, holds the glue callbacks between them and renders the layout plus every modal; feature behavior itself lives in `hooks/`).
- **State + storage**: `apps/web/src/state/useStore.ts` (Zustand) + `apps/web/src/storage/db.ts` (Dexie).
- **Backend sharing/sync**: `apps/web/src/sharing/` — `apiClient.ts` (REST client), `socketSync.ts` (WebSocket realtime sync manager), `storeSyncBridge.ts` (wires incoming sync data into the store). Protocol details in `docs/websocket-sync-protocol.md` and `docs/frontend-sharing-sync.md`.
- **i18n**: `apps/web/src/i18n/` — locale resolution (`resolveLocale.ts`), translations (`resources.ts`), `useI18n()`/module-level `t()`. Language auto-suggestion logic lives in `apps/web/src/domain/languageSuggestion.ts`.
- **Domain logic**: `apps/web/src/domain/` (categories, sorting, input parsing, list stats) plus shared types in `packages/shared/src/domain/types.ts`.
- **UI composition**: `apps/web/src/components/` (shared UI building blocks, including the `Modal.tsx` scaffold all dialogs build on) + `apps/web/src/hooks/` (one hook per feature: popup stack, toasts, dialogs, pull-to-refresh, back-gesture trap, item exit animation, share flow, app bootstrap).
- **Styling**: `apps/web/src/styles.css`.
- **localStorage keys**: `golist.deviceId`, `golist.selectedListId`, plus the i18n keys defined in `apps/web/src/i18n/config.ts`.

## Quickstart
- Requires Node `>= 24` (see `engines` in the root `package.json`).
- Fresh (agent) container: `scripts/agent-setup.sh` installs deps and sets up the Playwright browser (prints `export` lines to eval when not run from the SessionStart hook).
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
- **Invite links on iOS**: iOS opens links in Safari, never in the installed home-screen app, and the two keep
  separate storage. So a `?shareToken=` link opened in an iOS browser tab (`apps/web/src/domain/iosBrowserTab.ts`)
  is not joined automatically; `InviteLandingModal` offers to copy the invite for the home-screen app (whose Join
  dialog has a one-tap "Paste from clipboard" button) or to use the list in the browser.
- **Undo toasts** for item deletion and list rename (max 3 stacked, 5s timeout).
- **Pull-to-refresh** forces a WebSocket reconnect; the pull distance is written straight to the DOM to avoid per-frame re-renders.
- **Item grid animations**: `apps/web/src/hooks/useGridLayoutAnimation.ts` (FLIP via the Web Animations API) glides cards into new slots and pops in new cards; skipped on first render, on list switches and with reduced motion. A checked-off card leaves the grid as soon as its exit animation ends, without waiting for the IndexedDB write.
- **Drawer swipe**: like pull-to-refresh, drag frames write the drawer transform and backdrop opacity straight to the DOM. The drawer only subscribes to `items` (for its "last updated" labels) while it is shown.
- **Back-gesture trap**: a history sentinel keeps the Android/Firefox back gesture inside the PWA and closes the topmost popup instead. Do not touch `apps/web/src/hooks/useBackGestureTrap.ts` without reading its comments — the behavior encodes hard-won Firefox/Fenix quirks.
- **Popup layering**: all overlays register in `apps/web/src/hooks/usePopupStack.ts`; the stack order is the open order and drives both "is any popup open" checks and back-gesture close order. New modals must open/close through the popup stack.

## UX rules (high-level)
- Keep list rename inline with minimal friction (no full-screen modals).
- Preserve item ordering behavior unless the change explicitly targets sorting.
- Suggestions must remain list-scoped and prioritize frequency then recency.

## Development commands
- `npm run verify` — lint + typecheck + unit/sim tests for web and backend (~30s); `npm run verify:changed` picks only what the changed files need; `npm run verify:full` adds the web + backend builds and Playwright E2E. Prints a pass/fail summary.
- `npm install`
- `npm run dev:web`
- `npm run lint -w apps/web`
- `npm run typecheck -w apps/web`
- `npm run build -w apps/web`
- `npm run test -w apps/web` (unit tests + sync simulation scenarios; `test:unit` / `test:sim` run one of them)
- `npm run test:sync-fuzz -w apps/web` — randomized multi-device sync fuzzing, **on demand only** (not in CI, not scheduled)
- `eval "$(scripts/local-postgres.sh)"` — start a throwaway local Postgres and export `PG*` (enables repository + differential tests and `E2E_BACKEND=postgres`)
- `npm run db:migrate -w apps/backend`
- `npm run db:seed -w apps/backend`

## CI/CD
- GitHub Actions `ci.yml` workflow validates `lint`, `typecheck`, `test` (incl. the sync simulation) and `build` for the web workspace plus backend `lint`/`typecheck`/`test` on PRs, and runs the Playwright E2E suite against both the in-memory and the Postgres backend. Failed E2E runs upload traces, per-device WebSocket frames/console logs and the backend log as the `e2e-<backend>-artifacts` artifact.
- GitHub Actions `backend-bootstrap.yml` runs backend `lint` + `typecheck` + `db:migrate` + `test` (against ephemeral Postgres) on PRs that touch `apps/backend/**`.
- Deploy workflow builds on `main`.

## Testing expectations
- Always run `npm run typecheck -w apps/web` for web changes and `npm run typecheck -w apps/backend` for backend changes before commit.
- Always run `npm run lint -w apps/web` for web changes and `npm run lint -w apps/backend` for backend changes before commit.
- Run `npm run test -w apps/web` for changes to `apps/web/src/domain/`, `apps/web/src/state/`, `apps/web/src/storage/`, `apps/web/src/sharing/`, `packages/shared/` or backend sync routes/repositories (it includes the sync simulation, which runs the backend in-process).
- For sync changes, consider an explicit fuzz run (`npm run test:sync-fuzz -w apps/web`, e.g. `FUZZ_RUNS=300 FUZZ_DEVICES=4`); see the testing playbook below.
- Run `npm run test -w apps/backend` for backend endpoint/config changes. Repository tests
  (`postgres-list-repository.test.ts`, `repository-differential.test.ts`) only run when `PGHOST`/`DATABASE_URL`
  is set — use `eval "$(scripts/local-postgres.sh)"` locally.
- Run `npm run test:e2e -w apps/web` for changes to UI flows, the store, sync or backend routes
  (with `E2E_BACKEND=postgres` too when touching the Postgres repository).
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

- Playwright E2E in fresh containers: run `scripts/agent-setup.sh` (automatic in Claude Code
  cloud sessions via the SessionStart hook). When the preinstalled Chromium build differs from
  the one the pinned Playwright expects, it exports `PLAYWRIGHT_CHROMIUM_EXECUTABLE`, which
  `playwright.config.ts` uses. Without any browser: `npx playwright install chromium` and
  `npx playwright install-deps chromium`.
  For E2E-related changes, run the Playwright E2E command before committing.
- The repo root has a hoisted `vite` 7 (pulled in by vitest) while `apps/web` uses vite 8;
  always start the web dev server through `npm run dev -w apps/web`, never a bare `vite`.

## End-to-end tests (`apps/web/e2e/`)
- Playwright Test suite (`apps/web/playwright.config.ts`). `npm run test:e2e -w apps/web`
  starts the real Fastify backend (`e2e/support/backend-server.ts`, port 3100) and the Vite
  dev server (port 4173, `ENVIRONMENT=production` so the debug log panel doesn't cover
  toasts), then drives Chromium against them.
- Backend storage: `E2E_BACKEND=memory` (default, no DB needed) or `E2E_BACKEND=postgres`
  (production repository; uses the usual `PG*` env vars and runs migrations first). CI runs both.
- Specs: `lists.spec.ts`, `items.spec.ts`, `sync.spec.ts` (multi-device share/join, realtime
  propagation, offline reconciliation), `sync-conflicts.spec.ts` (concurrent offline edits, three
  devices, slow network), `ui.spec.ts` (i18n, language suggestion, stats, legal, back gesture,
  join errors), `ios-invite.spec.ts` (iOS invite screen, join-dialog paste button).
- Fixtures (`e2e/fixtures.ts`): `app` = primary device (already on `/`), `newDevice()` = extra
  isolated device (own browser context), `backend` = REST client to assert server state.
  `GoListApp` (`e2e/support/goListApp.ts`) is the page object; `disconnectBackend()` /
  `reconnectBackend()` cut a single device off the backend (REST + WebSocket) and
  `setBackendLatency(ms)` slows it down. `e2e/support/multiDevice.ts` has `shareAcross()` (share the
  active list with N new devices) and `expectDevicesConverged()` (all devices + backend agree).
  Tests fail on any uncaught page error. Failing tests get each device's WebSocket frames
  (`device-*-websocket-frames.txt`), browser console (`device-*-console.txt`) and the backend log
  lines written during the test (`backend-log.jsonl`) attached in `test-results/`; the full backend
  log is `apps/web/.e2e-logs/backend.log`.
- Throwaway exploration specs go in `e2e/scratch/` (gitignored); run them with
  `npx playwright test e2e/scratch/foo.spec.ts`.
- The language-switch suggestion is suppressed by default (it would pop over unrelated tests);
  opt back in with `test.use({ initOptions: { suppressLanguageSuggestion: false } })`.
- Add an E2E test for every user-visible behavior change and for every sync bug fix.

## Testing playbook (for agents)

Pick the fastest layer that can show the behavior:

| What you are testing | Layer | Where | Speed |
| --- | --- | --- | --- |
| Pure logic (sorting, parsing, conflict rules) | vitest unit / fast-check property | `apps/web/src/**/*.test.ts` | ms |
| Sync between devices: offline, conflicts, races, restarts, reconnects | sync simulation | `apps/web/sim/scenarios/` | ~0.1–0.5s per test |
| Backend routes / WebSocket protocol | backend vitest | `apps/backend/src/*.test.ts` | ms |
| In-memory vs Postgres repository behaviour | differential property test | `apps/backend/src/repositories/repository-differential.test.ts` (needs Postgres) | seconds |
| UI flows in a real browser (IndexedDB, gestures, dialogs) | Playwright | `apps/web/e2e/` | seconds per test |

Workflow:
1. **Reproduce first.** Write a failing test at the lowest layer that shows the bug, and check
   it fails for the right reason before you fix anything. For sync bugs that is almost always
   a sim scenario (`apps/web/sim/README.md`).
2. **Fix, then prove it.** Run `npm run verify:changed` (or `npm run verify`). For UI or sync
   changes, also run E2E (`npm run test:e2e -w apps/web`).
3. **Hunting for unknown sync bugs:** run the fuzzer explicitly, e.g.
   `FUZZ_RUNS=300 FUZZ_DEVICES=4 FUZZ_COMMANDS=40 npm run test:sync-fuzz -w apps/web` with a few
   seeds. It shrinks failures to a minimal command list; turn that into a scenario test. Never
   wire the fuzzer into CI or a schedule; it runs only when someone asks for it.
4. **Reading failures:** sim failures print server + device state and recent frames. E2E failures
   attach frames, console and backend log (`test-results/`, or the CI artifact).

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


## Before opening a PR
- **Review your own diff first.** Run `/code-review` (or an independent review subagent) on the diff and address
  its findings before you open the PR. Recent agent PRs (#357, #358, #359) each had 2–4 real bugs that a reviewer
  only found after the PR was open.
- **Prove every regression test can fail.** Run it once with the fix reverted (or stubbed out) and confirm it fails
  for the right reason; a test that passes either way proves nothing (the #358 leak test could never fail).
- **Follow-ups become issues.** Every "not in this PR" / "follow-up" / "known remaining gap" note gets a GitHub issue
  (search for an existing one first), linked from the PR body.
- **Descriptive PR titles.** The title is a short sentence describing the change ("Broadcast REST list renames to
  WebSocket subscribers"), never the branch name (#324 was titled "Claude/api category icon defaults mtnba0").
- Fill in `.github/pull_request_template.md` (Summary / Changes / Tests / Follow-up issues).
- Run `npm run verify:changed` yourself before every push and fix what it reports. `.claude/hooks/pre-push-verify.sh`
  will enforce this once it is registered in `.claude/settings.json`; until then nothing checks it for you.

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
