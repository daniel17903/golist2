---
name: fix-sync-bug
description: Workflow for reproducing and fixing GoList realtime/offline sync bugs. Use whenever a report or task involves lists or items not syncing between devices, lost or reverted edits, renames not arriving, offline changes not reconciling, duplicate/ghost items, conflicts, reconnect problems, or a sync fuzzer failure — and whenever you change apps/web/src/sharing/ (socketSync.ts, storeSyncBridge.ts, apiClient.ts), the store's sync paths, or backend sync routes/repositories (apps/backend/src/routes/sync-websocket.ts etc.).
---

# Fix a sync bug

Sync bugs are races between devices, the server and IndexedDB. They are easy
to "fix" in a way that moves the bug somewhere else, so this workflow is
built around reproducing first and then hunting for regressions with the
fuzzer. Lessons from PR #357 (four bugs found by the sim/fuzzer) and PR #358
(a #357 fix that silently dropped renames, found only by the fuzzer) are
folded in below.

Read before touching protocol code: `docs/websocket-sync-protocol.md`,
`docs/frontend-sharing-sync.md`, `apps/web/sim/README.md`.

## 1. Reproduce in the sync simulation

The sim (`apps/web/sim/`) runs the real store, Dexie DB, REST client and
WebSocket client for several devices against the real Fastify backend in one
Node process (~0.1–0.5s per test). Almost every sync bug can be shown there;
use Playwright only when the bug needs the UI.

Add a scenario to the closest file in `apps/web/sim/scenarios/`:
- `sync.sim.test.ts` — propagation, offline reconciliation, tie-breaks,
  restarts, clock skew;
- `races.sim.test.ts` — a local edit racing an incoming change, writes right
  before a disconnect, losing writes.

```ts
it("delivers a rename sent right before the app restarts", async () => {
  sim = await SyncSim.start();
  const { listId, devices: [a, b] } = await sim.sharedList(2);
  await a.renameActiveList("Weekend");
  await a.restart();
  await sim.waitForConvergence(listId);
  expect(b.listName()).toBe("Weekend");
});
```

Useful levers (full table in the sim README): `goOffline()/goOnline()`,
`network.latencyMs`, `network.allowIncoming/allowOutgoing` (drop frames, or
start a local edit inside the filter to hit a race window), `restart()`,
`sim.server.restart()`, `sim.clock.freeze()/set()/advance()`.

Assert the user-visible outcome **and** persistence: `visibleItemNames()`,
`listName()`, plus `persistedItems(listId)` / `persistedList(listId)` —
several past bugs were "memory right, IndexedDB wrong" or the reverse.

Run it and **check it fails for the right reason**:

```bash
npx vitest run --project sim apps/web/sim/scenarios/races.sim.test.ts -t "rename sent right before"
```

A scenario that fails because of a typo or a timing assumption proves
nothing. Read the convergence dump (server items, each device's state, last
WebSocket frames) and confirm it shows the bug you were told about. If the
scenario passes, the reproduction is wrong or incomplete — don't fix
anything yet.

If the bug came from the fuzzer, replay the shrunk sequence step by step
(see "When the fuzzer finds something" in the sim README); extra steps often
matter for timing.

## 2. Fix

- Find the root cause in the dump/frames before editing. Know which side
  (client store, sync client, server route, repository) is wrong.
- Keep the conflict rule intact: last write wins by `updatedAt`, with a
  deterministic tie-break (shared helpers like `shouldAcceptItem` /
  `shouldAcceptListMetadata`). Incoming writes are re-checked inside the
  IndexedDB transaction so they can't overwrite a newer local edit.
- Think about every path a write takes. Example from #358: a rename goes over
  REST *and* as a WebSocket `list_metadata_patch`; REST stores it but doesn't
  notify subscribers. #357 started skipping queued messages from a closing
  socket (to avoid registering dead subscribers) — which silently dropped the
  only copy that notified other devices. The narrower fix was to keep
  processing messages that arrived before the close and only drop *replies*
  to a closed socket.
- Prefer the narrowest change that fixes the root cause; broad "skip/ignore
  when X" guards are where regressions hide.

## 3. Prove it

1. The new scenario passes; the rest still pass:
   ```bash
   npm run verify:changed        # or npm run verify
   ```
2. **Run the fuzzer with several seeds** — this is what caught #358:
   ```bash
   for seed in 101 202 303 404; do
     FUZZ_SEED=$seed FUZZ_RUNS=300 FUZZ_DEVICES=4 FUZZ_COMMANDS=40 npm run test:sync-fuzz -w apps/web || break
   done
   ```
   For comparison, run the same seeds on `main` when useful ("fail on main,
   pass with fix" is strong evidence). A new fuzz failure becomes another
   scenario (back to step 1). It can also be a harness/reference-model gap —
   check that before changing app code. The fuzzer is on demand only: never
   wire it into CI or a schedule.
3. Backend touched? `npm run test -w apps/backend`. Postgres repository
   touched? `eval "$(scripts/local-postgres.sh)"` first so the repository and
   differential tests run, and run E2E with `E2E_BACKEND=postgres` too.
4. **User-visible bug? Add an E2E test** in `apps/web/e2e/sync.spec.ts` or
   `sync-conflicts.spec.ts` (fixtures: `app`, `newDevice()`, `backend`;
   helpers: `shareAcross()`, `expectDevicesConverged()`,
   `disconnectBackend()/reconnectBackend()`, `setBackendLatency()`), then:
   ```bash
   npm run test:e2e -w apps/web
   ```
   AGENTS.md requires an E2E test for every sync bug fix.

## 4. Docs and PR

- Protocol behavior changed (new message, new reply, changed ordering or
  dropping rules)? Update `docs/websocket-sync-protocol.md`. Frontend sync
  flow changed? Update `docs/frontend-sharing-sync.md`.
- PR body: the symptom in user terms, root cause, fix, the scenario(s) that
  failed before and pass after, fuzzer seeds/runs used, and any known
  remaining gap you deliberately left (like #358 did).
