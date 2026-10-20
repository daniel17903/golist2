# Testing plan: faster, more automated tests for agents and CI

Goal: let AI agents (and humans) find existing bugs and validate their work
faster, with a focus on multi-device sync. Every layer must run both in GitHub
Actions and inside a fresh agent container.

## Starting point (before this plan)

- Web unit tests (vitest): 98, ~2s. Backend unit tests: 32 (+3 Postgres-only), ~2s.
- Playwright E2E: 59 full-stack tests (multi-device fixtures, offline switch,
  WebSocket frame capture), ~1.5 min on 4 cores, run in CI against the
  in-memory and the Postgres backend.

Gaps found:

1. A fresh agent container could not run E2E: the pinned Playwright wants a
   newer Chromium build than the one preinstalled under `/opt/pw-browsers`,
   and the config had no override. No SessionStart hook existed.
2. CI uploaded no traces/`test-results/`; backend stdout was discarded.
3. No single "run the right checks" command.
4. No layer between mocked-socket unit tests and the slow browser suite that
   runs the real client sync code against the real server.
5. Sync tests were all example-based, although most recent bug fixes
   (#309, #340, #342, #356) were sync convergence bugs.
6. Store, sync manager, API client and Dexie DB were module singletons using
   `Date.now()` directly — impossible to run several devices in one process or
   force timestamp ties.
7. E2E sync coverage: two devices, mostly one-sided offline edits.

## Decisions

- Refactoring the store/sync manager/API client/DB into factories with an
  injectable clock is OK.
- New dev dependencies: `fast-check`, `fake-indexeddb`.
- **No scheduled/nightly fuzzing.** Randomized multi-device fuzzing runs only
  when an agent explicitly triggers it (`npm run test:sync-fuzz -w apps/web`).
  CI only runs deterministic tests (fixed-seed property tests included).

## Phase 0 — make everything runnable by agents

- `PLAYWRIGHT_CHROMIUM_EXECUTABLE` env var honoured by `playwright.config.ts`.
- `scripts/agent-setup.sh` + `.claude/settings.json` SessionStart hook:
  installs deps, detects a Playwright/Chromium mismatch and exports the
  override, reports Postgres availability.
- Root scripts: `npm run verify` (lint + typecheck + unit/sim tests, web and
  backend), `npm run verify:changed` (picks checks from the AGENTS.md matrix
  using `git diff`), `npm run verify:full` (adds E2E).
- E2E failure artifacts: backend log written to `test-results/backend.log`,
  browser console attached to failing tests.
- CI uploads `test-results/` and the Playwright report on failure.

## Phase 1 — headless multi-device sync harness (Node, vitest)

- `createGoListStore(env)`, `SocketSyncManager` options, `createSharingApiClient()`
  and `new GoListDatabase(name, dexieOptions)`; module singletons stay as
  defaults so the app is unchanged.
- `apps/web/sim/harness/`: boots the real Fastify server (in-memory repository)
  on a free port; each virtual device gets its own store, fake IndexedDB,
  localStorage map, controllable clock, fetch and WebSocket.
- Per-device network control: offline/online, frame delay, dropping frames;
  server restart that keeps the repository.
- `waitForConvergence()` asserts that every device and the server agree on
  list name and item digest; failure output contains each device's frame log.
- Deterministic scenario tests in `apps/web/sim/scenarios/` run with
  `npm run test -w apps/web` (seconds, not minutes).

## Phase 2 — property-based and randomized sync testing

- Fixed-seed `fast-check` property tests for `packages/shared/src/domain/sync.ts`
  (digest order independence, total-order tie-breaks).
- On-demand randomized multi-device fuzz (`npm run test:sync-fuzz -w apps/web`):
  random command sequences across 2–4 devices (add, edit, toggle, rename,
  offline/online, restart, switch list), forced timestamp ties, compared against
  a last-write-wins reference model. Failures print a seed + shrunk command list;
  `FUZZ_SEED=… FUZZ_PATH=…` replays it. Not run in CI.
- Backend differential test: same random operation sequence against the
  in-memory and Postgres repositories (fixed seed; skipped without a database).

## Phase 3 — browser E2E for sync

- Fixture helpers: `shareAcross(app, newDevice, n)`, `expectDevicesConverged()`,
  `GoListApp.setBackendLatency(ms)`, `GoListApp.editItem()`.
- New scenarios: concurrent offline edits of the same item, delete vs. edit,
  three devices, both devices offline, slow network.
- `e2e/scratch/` (gitignored) for throwaway exploration specs.

## Phase 4 — CI and docs

- CI `validate` job runs backend lint/typecheck/tests too, because the web sim
  tests exercise the backend as well.
- AGENTS.md testing playbook: which layer to use, write the failing test first,
  how to read failure artifacts, how to trigger fuzzing.

## Status

Phases 0–4 are implemented. See the "Testing playbook" section in
`AGENTS.md` and `apps/web/sim/README.md` for how to use them.

### Bugs found while building this

The first fuzzer and differential-test runs found these, each now fixed and
covered by a regression test:

1. **Server processed a socket's messages concurrently.** A patch sent right
   behind `subscribe_list` could be handled before the subscription was
   registered and dropped (`not subscribed to list`). A rename made during the
   post-reconnect full-sync pass therefore never reached other devices.
   Fix: per-socket message chain in `sync-websocket.ts`.
2. **Losing patches were not reported to their sender.** A device whose write
   lost last-write-wins kept showing it until the next reconnect. Fix: the
   server sends the stored winner back to the sender (items and renames).
3. **Incoming changes could overwrite a concurrent local edit.** The client
   checked an incoming item/rename against in-memory state, awaited the
   IndexedDB write, then applied it unconditionally. A local edit landing in
   between was overwritten in IndexedDB and in memory. Renames are not echoed
   back to their sender, so that device kept the stale name for good. Fix:
   re-check inside the IndexedDB transaction (`shouldAcceptItem` /
   `shouldAcceptListMetadata`) and conditional state updates.
4. **Edits from a device with a slow clock were dropped.** A local edit was
   stamped with the device clock, which can be older than the version being
   edited. The server discarded it as stale and the device silently reverted
   later. Fix: local edits use `max(now, previous updatedAt + 1)`.

### Follow-ups

- Playwright project that runs against the production build (`vite preview`)
  to cover the service worker / offline boot (#363).
- Switching to a list whose items have not been hydrated yet right after
  boot briefly shows it empty (items appear once background hydration
  finishes). Not a data issue; the sim harness accounts for it (#364).
