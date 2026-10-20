import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { buildItemHash, shouldAcceptListMetadata, type ListMetadataSnapshot } from "@golist/shared/domain/sync";
import type { Item } from "@golist/shared/domain/types";
import { SyncSim, delay, type SimDevice } from "../harness";

// Randomized multi-device sync fuzzer. ON DEMAND ONLY — not part of
// `npm run test` or CI. Run it explicitly:
//
//   npm run test:sync-fuzz -w apps/web
//   FUZZ_RUNS=200 FUZZ_DEVICES=4 npm run test:sync-fuzz -w apps/web
//   FUZZ_SEED=123 FUZZ_PATH="4:2:1" npm run test:sync-fuzz -w apps/web   # replay a failure
//
// Every run starts a fresh backend + N devices sharing one list, executes a
// random command sequence (edits, offline/online, app restarts, list
// switches, clock skew, server restarts), then brings everyone online and
// checks that all devices and the server converged on the state a
// last-write-wins reference model predicts. On failure fast-check shrinks
// the command list; turn the shrunk sequence into a scenario test in
// sim/scenarios/ before fixing the bug.

const runs = Number(process.env.FUZZ_RUNS ?? 25);
const seed = process.env.FUZZ_SEED ? Number(process.env.FUZZ_SEED) : Date.now() % 2_147_483_647;
const path = process.env.FUZZ_PATH || undefined;
const maxDevices = Math.max(2, Number(process.env.FUZZ_DEVICES ?? 3));
const maxCommands = Number(process.env.FUZZ_COMMANDS ?? 30);
// A healthy simulation converges in well under a second; a short timeout
// keeps shrinking (which re-runs failing cases many times) fast.
const convergenceTimeoutMs = Number(process.env.FUZZ_CONVERGENCE_TIMEOUT_MS ?? 4_000);

const ITEM_NAMES = ["milk", "bread", "eggs", "apples", "cheese"];
const LIST_NAMES = ["Groceries", "Weekend", "groceries", "Party"];

type Command =
  | { kind: "add"; device: number; name: string; quantity?: string; skewMs: number }
  | { kind: "edit"; device: number; pick: number; name: string; quantity?: string; skewMs: number }
  | { kind: "toggle"; device: number; pick: number; skewMs: number }
  | { kind: "rename"; device: number; name: string; skewMs: number }
  | { kind: "offline"; device: number }
  | { kind: "online"; device: number }
  | { kind: "restart"; device: number }
  | { kind: "switchList"; device: number }
  | { kind: "wait"; ms: number }
  | { kind: "serverRestart" };

const device = fc.nat({ max: maxDevices - 1 });
// Negative skew = this device's clock is behind (its write may lose); 0 makes
// equal timestamps across devices likely, which exercises the tie-breaks.
const skewMs = fc.oneof({ weight: 3, arbitrary: fc.constant(0) }, { weight: 1, arbitrary: fc.integer({ min: -3, max: 3 }) });
const quantity = fc.option(fc.constantFrom("1", "2", "500g"), { nil: undefined });

const commandArb: fc.Arbitrary<Command> = fc.oneof(
  { weight: 5, arbitrary: fc.record({ kind: fc.constant("add" as const), device, name: fc.constantFrom(...ITEM_NAMES), quantity, skewMs }) },
  { weight: 4, arbitrary: fc.record({ kind: fc.constant("edit" as const), device, pick: fc.nat(), name: fc.constantFrom(...ITEM_NAMES), quantity, skewMs }) },
  { weight: 5, arbitrary: fc.record({ kind: fc.constant("toggle" as const), device, pick: fc.nat(), skewMs }) },
  { weight: 2, arbitrary: fc.record({ kind: fc.constant("rename" as const), device, name: fc.constantFrom(...LIST_NAMES), skewMs }) },
  { weight: 3, arbitrary: fc.record({ kind: fc.constant("offline" as const), device }) },
  { weight: 3, arbitrary: fc.record({ kind: fc.constant("online" as const), device }) },
  { weight: 1, arbitrary: fc.record({ kind: fc.constant("restart" as const), device }) },
  { weight: 1, arbitrary: fc.record({ kind: fc.constant("switchList" as const), device }) },
  { weight: 3, arbitrary: fc.record({ kind: fc.constant("wait" as const), ms: fc.integer({ min: 0, max: 60 }) }) },
  { weight: 1, arbitrary: fc.constant({ kind: "serverRestart" as const }) },
);

// Last-write-wins reference model: every version any device wrote, and the
// winner the protocol promises — max (updatedAt, item hash) per item, and
// shouldAcceptListMetadata for the list name.
class Model {
  private readonly versions = new Map<string, Item[]>();
  private listName: ListMetadataSnapshot;

  constructor(initial: ListMetadataSnapshot) {
    this.listName = initial;
  }

  recordItem(item: Item | undefined) {
    if (item) {
      this.versions.set(item.id, [...(this.versions.get(item.id) ?? []), item]);
    }
  }

  recordName(snapshot: ListMetadataSnapshot) {
    if (shouldAcceptListMetadata(snapshot, this.listName)) {
      this.listName = snapshot;
    }
  }

  expectedName() {
    return this.listName.name;
  }

  expectedItemHashes(): Map<string, string> {
    const expected = new Map<string, string>();
    for (const [id, versions] of this.versions) {
      const winner = versions.reduce((best, candidate) =>
        candidate.updatedAt > best.updatedAt ||
        (candidate.updatedAt === best.updatedAt && buildItemHash(candidate) > buildItemHash(best))
          ? candidate
          : best,
      );
      expected.set(id, buildItemHash(winner));
    }
    return expected;
  }
}

const describeCommands = (commands: Command[]) =>
  commands.map((command, index) => `  ${String(index).padStart(2)}: ${JSON.stringify(command)}`).join("\n");

const runScenario = async (deviceCount: number, commands: Command[]) => {
  const sim = await SyncSim.start();
  try {
    const { listId, devices } = await sim.sharedList(deviceCount);
    // Every device also has a private list so switching exercises the
    // subscribe/unsubscribe and full-sync-pass paths.
    const privateLists = new Map<SimDevice, string>();
    for (const entry of devices) {
      privateLists.set(entry, await entry.createList("Private"));
      entry.switchTo(listId);
    }
    const owner = devices[0];
    const ownerList = owner.state.lists.find((list) => list.id === listId)!;
    const model = new Model({ name: ownerList.name, updatedAt: ownerList.updatedAt });
    owner.itemsOf(listId).forEach((item) => model.recordItem(item));

    // Writes happen at the shared clock plus a per-command skew.
    const atSkew = async (skew: number, action: () => Promise<void>) => {
      const base = sim.clock.peek();
      sim.clock.set(base + skew);
      sim.clock.freeze();
      try {
        await action();
      } finally {
        sim.clock.unfreeze();
        sim.clock.set(Math.max(base, base + skew) + 1);
      }
    };
    const pickItem = (target: SimDevice, pick: number) => {
      const items = target.itemsOf(listId).sort((left, right) => left.id.localeCompare(right.id));
      return items.length > 0 ? items[pick % items.length] : undefined;
    };

    for (const command of commands) {
      if (command.kind === "wait") {
        await delay(command.ms);
        continue;
      }
      if (command.kind === "serverRestart") {
        await sim.server.restart(10);
        continue;
      }
      const target = devices[command.device % devices.length];
      // Item and rename commands only act while the shared list is open, as
      // in the UI.
      const onSharedList = target.state.activeListId === listId;
      switch (command.kind) {
        case "add":
          if (onSharedList) {
            const before = new Set(target.itemsOf(listId).map((item) => item.id));
            await atSkew(command.skewMs, () => target.addItem(command.name, command.quantity));
            // Not just "the first new item": a remote item can arrive meanwhile.
            model.recordItem(
              target
                .itemsOf(listId)
                .find((item) => !before.has(item.id) && item.createdByDeviceId === target.deviceId),
            );
          }
          break;
        case "edit": {
          const item = onSharedList ? pickItem(target, command.pick) : undefined;
          if (item) {
            await atSkew(command.skewMs, () => target.state.updateItem(item.id, command.name, command.quantity));
            model.recordItem(target.itemsOf(listId).find((entry) => entry.id === item.id));
          }
          break;
        }
        case "toggle": {
          const item = onSharedList ? pickItem(target, command.pick) : undefined;
          if (item) {
            await atSkew(command.skewMs, () => target.state.toggleItem(item.id));
            model.recordItem(target.itemsOf(listId).find((entry) => entry.id === item.id));
          }
          break;
        }
        case "rename":
          if (onSharedList) {
            await atSkew(command.skewMs, () => target.renameActiveList(command.name));
            const list = target.state.lists.find((entry) => entry.id === listId)!;
            model.recordName({ name: list.name, updatedAt: list.updatedAt });
          }
          break;
        case "offline":
          target.goOffline();
          break;
        case "online":
          target.goOnline();
          break;
        case "restart":
          await target.restart();
          break;
        case "switchList":
          target.switchTo(onSharedList ? privateLists.get(target)! : listId);
          break;
      }
    }

    // Quiesce: everyone back online, on the shared list.
    for (const entry of devices) {
      entry.goOnline();
      entry.switchTo(listId);
    }
    await sim.waitForConvergence(listId, { devices, timeoutMs: convergenceTimeoutMs });

    const expectedHashes = model.expectedItemHashes();
    const server = await sim.server.listSnapshot(listId);
    const actualHashes = new Map(server!.items.map((item) => [item.id, buildItemHash(item)]));
    if (server!.name !== model.expectedName() || !mapsEqual(actualHashes, expectedHashes)) {
      throw new Error(
        `converged, but not on the last-write-wins state\n` +
          `expected name "${model.expectedName()}", got "${server!.name}"\n` +
          `expected item hashes ${JSON.stringify([...expectedHashes])}\n` +
          `actual item hashes   ${JSON.stringify([...actualHashes])}\n${await sim.describe(listId)}`,
      );
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`${message}\n\ncommands (${deviceCount} devices):\n${describeCommands(commands)}`, {
      cause: error,
    });
  } finally {
    await sim.dispose();
  }
};

const mapsEqual = (left: Map<string, string>, right: Map<string, string>) =>
  left.size === right.size && [...left].every(([key, value]) => right.get(key) === value);

describe("sync fuzz (on demand)", () => {
  it(`converges on the last-write-wins state (seed ${seed}, ${runs} runs)`, async () => {
    console.info(`[sync-fuzz] seed=${seed} runs=${runs} maxDevices=${maxDevices} maxCommands=${maxCommands}`);
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 2, max: maxDevices }),
        fc.array(commandArb, { minLength: 1, maxLength: maxCommands }),
        runScenario,
      ),
      // Shrinking re-runs simulations to minimize the failing command list;
      // FUZZ_NO_SHRINK=1 reports the first failure as found.
      { seed, numRuns: runs, path, endOnFailure: process.env.FUZZ_NO_SHRINK === "1", verbose: 1 },
    );
    expect(true).toBe(true);
  });
});
