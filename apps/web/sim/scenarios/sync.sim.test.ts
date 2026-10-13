import { afterEach, describe, expect, it } from "vitest";
import { SyncSim, delay } from "../harness";

// Deterministic multi-device sync scenarios. Each test runs the real web
// store + sync client for every device against the real backend in-process.
// Prefer adding a scenario here over a Playwright test when a sync bug does
// not need the UI: it runs in milliseconds and the failure message contains
// every device's state and recent WebSocket frames.

let sim: SyncSim;
afterEach(async () => {
  await sim?.dispose();
});

describe("realtime propagation", () => {
  it("propagates adds, check-offs, edits and renames in both directions", async () => {
    sim = await SyncSim.start();
    const { listId, devices: [a, b] } = await sim.sharedList(2);

    await a.addItem("milk", "1L");
    await b.addItem("bread");
    await sim.waitForConvergence(listId);
    expect(a.visibleItemNames()).toEqual(["bread", "milk"]);

    await b.checkOff("milk");
    await a.editItem("bread", "rye bread", "2");
    await b.renameActiveList("Weekend");
    await sim.waitForConvergence(listId);

    expect(a.visibleItemNames()).toEqual(["rye bread"]);
    expect(b.item("rye bread")?.quantityOrUnit).toBe("2");
    expect(a.state.lists.find((list) => list.id === listId)?.name).toBe("Weekend");
  });

  it("restores a checked-off item on every device", async () => {
    sim = await SyncSim.start();
    const { listId, devices: [a, b] } = await sim.sharedList(2);
    await a.addItem("eggs");
    await sim.waitForConvergence(listId);

    await b.checkOff("eggs");
    await sim.waitForConvergence(listId);
    await a.restore("eggs");
    await sim.waitForConvergence(listId);

    expect(b.visibleItemNames()).toEqual(["eggs"]);
  });

  it("keeps three devices in sync", async () => {
    sim = await SyncSim.start();
    const { listId, devices: [a, b, c] } = await sim.sharedList(3);

    await a.addItem("apples");
    await b.addItem("pears");
    await c.addItem("plums");
    await sim.waitForConvergence(listId);
    await c.checkOff("apples");
    await sim.waitForConvergence(listId);

    for (const device of [a, b, c]) {
      expect(device.visibleItemNames()).toEqual(["pears", "plums"]);
    }
  });

  it("a late joiner receives the full history, including checked-off items", async () => {
    sim = await SyncSim.start();
    const { listId, token, devices: [a] } = await sim.sharedList(1);
    await a.addItem("salt");
    await a.addItem("pepper");
    await a.checkOff("salt");
    await sim.waitForConvergence(listId);

    const late = await sim.device();
    await late.join(token);
    await sim.waitForConvergence(listId);

    expect(late.itemsOf(listId).map((item) => [item.name, item.deleted]).sort()).toEqual([
      ["pepper", false],
      ["salt", true],
    ]);
  });

  it("propagates under network latency", async () => {
    sim = await SyncSim.start();
    const { listId, devices: [a, b] } = await sim.sharedList(2);
    a.network.latencyMs = 40;
    b.network.latencyMs = 15;

    await a.addItem("tea");
    await b.addItem("coffee");
    await a.checkOff("tea");
    await sim.waitForConvergence(listId);

    expect(b.visibleItemNames()).toEqual(["coffee"]);
  });
});

describe("offline reconciliation", () => {
  it("pushes offline edits and pulls missed remote edits after reconnecting", async () => {
    sim = await SyncSim.start();
    const { listId, devices: [a, b] } = await sim.sharedList(2);
    await a.addItem("bread");
    await sim.waitForConvergence(listId);

    a.goOffline();
    await a.addItem("apples");
    await a.checkOff("bread");
    await a.renameActiveList("Offline rename");
    await b.addItem("water");

    a.goOnline();
    await sim.waitForConvergence(listId, { devices: [a, b] });

    expect(b.visibleItemNames()).toEqual(["apples", "water"]);
    expect(a.visibleItemNames()).toEqual(["apples", "water"]);
    expect(b.state.lists.find((list) => list.id === listId)?.name).toBe("Offline rename");
  });

  it("converges when both devices edited the same item offline (later write wins)", async () => {
    sim = await SyncSim.start();
    const { listId, devices: [a, b] } = await sim.sharedList(2);
    await a.addItem("cheese");
    await sim.waitForConvergence(listId);

    a.goOffline();
    b.goOffline();
    await a.editItem("cheese", "gouda");
    await b.editItem("cheese", "cheddar"); // later timestamp

    // Reconnect the device holding the *older* write last: it must not win.
    b.goOnline();
    await sim.waitForConvergence(listId, { devices: [b] });
    a.goOnline();
    await sim.waitForConvergence(listId, { devices: [a, b] });

    expect(a.visibleItemNames()).toEqual(["cheddar"]);
  });

  it("converges when both devices rename the list offline (later rename wins)", async () => {
    sim = await SyncSim.start();
    const { listId, devices: [a, b] } = await sim.sharedList(2);

    a.goOffline();
    b.goOffline();
    await b.renameActiveList("First");
    await a.renameActiveList("Second");
    b.goOnline();
    a.goOnline();
    await sim.waitForConvergence(listId, { devices: [a, b] });

    expect(b.state.lists.find((list) => list.id === listId)?.name).toBe("Second");
  });

  it("an offline check-off and a later remote edit converge on the newer state", async () => {
    sim = await SyncSim.start();
    const { listId, devices: [a, b] } = await sim.sharedList(2);
    await a.addItem("yoghurt");
    await sim.waitForConvergence(listId);

    a.goOffline();
    await a.checkOff("yoghurt");
    await b.editItem("yoghurt", "greek yoghurt", "500g"); // newer, still visible
    a.goOnline();
    await sim.waitForConvergence(listId, { devices: [a, b] });

    expect(a.visibleItemNames()).toEqual(["greek yoghurt"]);
  });

  it("delivers offline edits made on a list that is not open after reconnecting", async () => {
    sim = await SyncSim.start();
    const { listId, devices: [a, b] } = await sim.sharedList(2);
    const privateList = await a.createList("Private");
    await a.waitUntilOnline();

    a.goOffline();
    a.switchTo(listId);
    await a.addItem("offline item");
    a.switchTo(privateList);
    a.goOnline();

    // The full sync pass after reconnecting reconciles every known list.
    await sim.waitForConvergence(listId, { devices: [a, b] });
    expect(b.visibleItemNames(listId)).toEqual(["offline item"]);
  });

  it("registers a list created offline once back online", async () => {
    sim = await SyncSim.start();
    const a = await sim.device();
    await a.createList("Home");
    await a.waitUntilOnline();

    a.goOffline();
    const offlineList = await a.createList("Made offline");
    await a.addItem("milk");
    a.goOnline();

    await sim.waitForConvergence(offlineList, { devices: [a] });
    const server = await sim.server.listSnapshot(offlineList);
    expect(server?.name).toBe("Made offline");
    expect(server?.items.map((item) => item.name)).toEqual(["milk"]);
  });
});

describe("deterministic tie-breaks", () => {
  it("converges when two devices write the same item with the same timestamp", async () => {
    sim = await SyncSim.start();
    const { listId, devices: [a, b] } = await sim.sharedList(2);
    await a.addItem("flour");
    await sim.waitForConvergence(listId);

    a.goOffline();
    b.goOffline();
    sim.clock.freeze();
    await a.editItem("flour", "rye flour");
    await b.editItem("flour", "wheat flour");
    expect(a.item("rye flour")?.updatedAt).toBe(b.item("wheat flour")?.updatedAt);
    sim.clock.unfreeze();

    a.goOnline();
    b.goOnline();
    await sim.waitForConvergence(listId, { devices: [a, b] });
    expect(a.visibleItemNames()).toEqual(b.visibleItemNames());
  });

  it("converges when two devices rename the list with the same timestamp", async () => {
    sim = await SyncSim.start();
    const { listId, devices: [a, b] } = await sim.sharedList(2);

    a.goOffline();
    b.goOffline();
    sim.clock.freeze();
    await a.renameActiveList("Alpha");
    await b.renameActiveList("Beta");
    sim.clock.unfreeze();
    a.goOnline();
    b.goOnline();

    await sim.waitForConvergence(listId, { devices: [a, b] });
    // Equal timestamps: the lexicographically greater name wins everywhere.
    expect(a.state.lists.find((list) => list.id === listId)?.name).toBe("Beta");
  });
});

describe("restarts", () => {
  it("syncs edits that only exist in IndexedDB after an offline app restart", async () => {
    sim = await SyncSim.start();
    const { listId, devices: [a, b] } = await sim.sharedList(2);

    a.goOffline();
    await a.addItem("apples");
    await a.restart();
    expect(a.visibleItemNames(listId)).toEqual(["apples"]);
    a.goOnline();

    await sim.waitForConvergence(listId, { devices: [a, b] });
    expect(b.visibleItemNames()).toEqual(["apples"]);
  });

  it("recovers from a backend restart and syncs edits made during the downtime", async () => {
    sim = await SyncSim.start();
    const { listId, devices: [a, b] } = await sim.sharedList(2);
    await a.addItem("before");
    await sim.waitForConvergence(listId);

    await sim.server.stop();
    await a.addItem("during downtime");
    await b.checkOff("before");
    await delay(100);
    await sim.server.restart();

    await sim.waitForConvergence(listId);
    expect(a.visibleItemNames()).toEqual(["during downtime"]);
    expect(b.visibleItemNames()).toEqual(["during downtime"]);
  });

  it("persists what it shows: IndexedDB matches the in-memory state after sync", async () => {
    sim = await SyncSim.start();
    const { listId, devices: [a, b] } = await sim.sharedList(2);
    await a.addItem("oats");
    await a.addItem("honey");
    await a.checkOff("oats");
    await sim.waitForConvergence(listId);

    const persisted = await b.persistedItems(listId);
    const byId = (left: { id: string }, right: { id: string }) => left.id.localeCompare(right.id);
    expect(persisted.sort(byId)).toEqual([...b.itemsOf(listId)].sort(byId));
  });
});

describe("local list deletion", () => {
  it("deleting a shared list on one device leaves the others syncing", async () => {
    sim = await SyncSim.start();
    const { listId, devices: [a, b, c] } = await sim.sharedList(3);
    await c.deleteList(listId);

    await a.addItem("still shared");
    await sim.waitForConvergence(listId, { devices: [a, b] });
    expect(b.visibleItemNames()).toEqual(["still shared"]);
    expect(c.hasList(listId)).toBe(false);
  });
});

describe("clock skew", () => {
  // Regression (found by the sync fuzzer): an edit from a device whose clock
  // is behind used to get an `updatedAt` older than the version it edited,
  // so the server dropped it as stale while the editing device kept showing
  // it — until its next reconnect silently reverted the user's action.
  it("an edit from a device with a slow clock still wins over the version it edited", async () => {
    sim = await SyncSim.start();
    const { listId, devices: [a, b] } = await sim.sharedList(2);
    await a.addItem("cheese");
    await sim.waitForConvergence(listId);

    const now = sim.clock.peek();
    sim.clock.set(now - 60_000); // b's clock is a minute behind
    await b.checkOff("cheese");
    await b.renameActiveList("Renamed by b");
    sim.clock.set(now);

    await sim.waitForConvergence(listId);
    expect(a.visibleItemNames()).toEqual([]);
    expect(a.listName()).toBe("Renamed by b");
  });
});
