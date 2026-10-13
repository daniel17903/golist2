# Multi-device sync simulation (`apps/web/sim`)

Runs the **real** web store, Dexie database, REST client and WebSocket sync
client for several simulated devices against the **real** Fastify backend,
all in one Node process. No browser, no React. A two-device
share-and-sync round trip takes ~0.2s instead of seconds in Playwright.

Use it first for anything sync-related: reproducing a sync bug, checking a
protocol change, or testing conflicts and races. Use Playwright (`e2e/`) for
behavior that needs the UI.

```
harness/   SyncSim (server + devices), SimDevice, DeviceNetwork, SimClock
scenarios/ deterministic tests — run in `npm run test` and CI
fuzz/      randomized fuzzer — ON DEMAND ONLY, never in CI
```

## Commands

```bash
npm run test:sim -w apps/web                 # scenarios only
npm run test -w apps/web                     # unit + scenarios
npm run test:sync-fuzz -w apps/web           # randomized fuzzing (explicit trigger)
```

Fuzz knobs (environment variables): `FUZZ_RUNS` (default 25), `FUZZ_SEED`
(default: random, printed), `FUZZ_DEVICES` (max devices, default 3),
`FUZZ_COMMANDS` (max commands per run, default 30), `FUZZ_PATH` (replay one
case), `FUZZ_NO_SHRINK=1`, `FUZZ_CONVERGENCE_TIMEOUT_MS` (default 4000).

## Writing a scenario

```ts
import { afterEach, expect, it } from "vitest";
import { SyncSim } from "../harness";

let sim: SyncSim;
afterEach(async () => {
  await sim?.dispose();
});

it("pushes offline edits after reconnecting", async () => {
  sim = await SyncSim.start();
  const { listId, devices: [a, b] } = await sim.sharedList(2); // a creates + shares, b joins

  a.goOffline();
  await a.addItem("milk", "1L");
  await a.checkOff("bread");          // items are looked up by name in the active list
  a.goOnline();

  await sim.waitForConvergence(listId); // server + all devices agree (name + item digest)
  expect(b.visibleItemNames()).toEqual(["milk"]);
});
```

What you can control:

| Need | API |
| --- | --- |
| Offline / online (REST + socket) | `device.goOffline()`, `device.goOnline()` |
| Slow network | `device.network.latencyMs = 200` |
| Drop or intercept frames | `device.network.allowIncoming = (frame) => …` (also `allowOutgoing`); return `false` to drop. The filter runs just before the client sees the frame, so you can start a local edit there to hit a race window. |
| App restart (IndexedDB + localStorage survive) | `await device.restart()` |
| Backend restart / downtime (data survives) | `await sim.server.restart()`, `sim.server.stop()` |
| Equal timestamps / clock skew | `sim.clock.freeze()`, `sim.clock.set(ms)`, `sim.clock.advance(ms)` |
| Server state | `await sim.server.listSnapshot(listId)`, `sim.server.repository` |
| Device state | `device.state` (Zustand state), `device.itemsOf(listId)`, `device.listName()`, `await device.persistedItems(listId)` |

`waitForConvergence` fails with a dump of the server's items and every
device's lists, items, errors and last 40 WebSocket frames. That dump is
usually enough to find the bug.

## When the fuzzer finds something

1. Read the failure: the shrunk command list is under `commands (N devices)`.
   The dump says either "did not converge" (devices disagree) or "converged,
   but not on the last-write-wins state" (everyone agrees on the wrong state).
2. Replay it: `FUZZ_SEED=<seed> FUZZ_PATH="<path>" FUZZ_NO_SHRINK=1 npm run test:sync-fuzz -w apps/web`.
3. Turn the shrunk sequence into a deterministic test in `scenarios/` and
   check that it fails. Replay the exact sequence, because the extra steps
   often matter for timing.
4. Fix the bug, then re-run the fuzzer with the same seed and a few new ones.
5. Check the harness too: a fuzz failure can also come from a wrong
   reference model or a harness gap (see git history for examples).
