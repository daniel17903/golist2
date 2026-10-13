import { afterEach, describe, expect, it } from "vitest";
import { SyncSim, delay, waitUntil } from "../harness";

// Races between a local edit and an incoming remote change for the same
// record. The network frame filter runs right before the frame reaches the
// sync client, so starting the local edit there lands it inside the window
// where the client is persisting the incoming change.

let sim: SyncSim;
afterEach(async () => {
  await sim?.dispose();
});

describe("local edit racing an incoming change", () => {
  // Regression: the incoming (older) rename used to be persisted and applied
  // over the newer local rename. The server does not echo renames back to
  // their sender, so the device kept the stale name for good.
  it("keeps a local rename made while an older incoming rename is applied", async () => {
    sim = await SyncSim.start();
    const { listId, devices: [a, b] } = await sim.sharedList(2);
    let localRename: Promise<void> | undefined;
    b.network.allowIncoming = (frame) => {
      if (frame.type === "list_metadata_patch" && !localRename) {
        localRename = b.renameActiveList("Local newer");
      }
      return true;
    };

    await a.renameActiveList("Remote older");
    await delay(50);
    await localRename;
    await sim.waitForConvergence(listId);

    expect(b.listName()).toBe("Local newer");
    expect((await b.persistedList(listId))?.name).toBe("Local newer");
  });

  it("keeps a local item edit made while an older incoming edit is applied", async () => {
    sim = await SyncSim.start();
    const { listId, devices: [a, b] } = await sim.sharedList(2);
    await a.addItem("milk");
    await sim.waitForConvergence(listId);
    let localEdit: Promise<void> | undefined;
    b.network.allowIncoming = (frame) => {
      if (frame.type === "item_patch" && !localEdit) {
        localEdit = b.editItem("milk", "oat milk");
      }
      // Drop the server's echo of b's own edit: it would otherwise repair a
      // wrongly overwritten local edit and hide the race.
      return !(frame.type === "item_patch" && JSON.stringify(frame).includes("oat milk"));
    };

    await a.editItem("milk", "whole milk");
    await delay(50);
    await localEdit;
    await sim.waitForConvergence(listId);

    expect(b.visibleItemNames()).toEqual(["oat milk"]);
    expect((await b.persistedItems(listId)).map((item) => item.name)).toEqual(["oat milk"]);
    expect(a.visibleItemNames()).toEqual(["oat milk"]);
  });
});

describe("rename during the post-reconnect full sync", () => {
  // Regression (found by the sync fuzzer, shrunk from seed 99): a rename made
  // while the device was mid full-sync pass must reach the other device.
  // The server-side cause (per-socket message reordering, which dropped the
  // list_metadata_patch with "not subscribed to list") needs a slow access
  // check to reproduce and is guarded by the backend integration test
  // "processes a socket's messages in order…"; with the in-memory
  // repository this end-to-end scenario guards the client-side handling.
  it("broadcasts a rename made right after reconnecting while other lists are reconciled", async () => {
    sim = await SyncSim.start();
    const { listId, devices: [a, b] } = await sim.sharedList(2);
    await a.createList("Private");
    await b.createList("Private");
    a.switchTo(listId);
    b.switchTo(listId);
    // The exact shrunk command sequence; the extra edits shape the timing.
    await a.addItem("milk");
    await a.editItem("milk", "milk");
    b.goOffline();
    await a.checkOff("milk");
    b.goOnline();
    await b.renameActiveList("Groceries");
    await a.editItem("milk", "milk");
    await a.restore("milk");

    await sim.waitForConvergence(listId);
    expect(a.listName()).toBe("Groceries");
  });
});

describe("losing writes", () => {
  // The server answers a patch that lost last-write-wins with the winning
  // version, sent to the sender only. Without that, a device that wrote on
  // top of a stale view (here: it missed a broadcast and its clock is behind)
  // keeps showing its losing write until it reconnects.
  it("a device whose edit loses is sent the winning version", async () => {
    sim = await SyncSim.start();
    const { listId, devices: [a, b] } = await sim.sharedList(2);
    await a.addItem("milk");
    await sim.waitForConvergence(listId);

    // b misses a's newer edit...
    let dropped = false;
    b.network.allowIncoming = (frame) => {
      if (!dropped && frame.type === "item_patch" && JSON.stringify(frame).includes("whole milk")) {
        dropped = true;
        return false;
      }
      return true;
    };
    sim.clock.advance(1_000); // a's edit is clearly newer than anything b writes below
    await a.editItem("milk", "whole milk");
    await waitUntil(() => dropped);

    // ...and edits its stale copy with a clock that is behind.
    const now = sim.clock.peek();
    sim.clock.set(b.item("milk")!.updatedAt + 1);
    await b.editItem("milk", "oat milk");
    sim.clock.set(now);

    await sim.waitForConvergence(listId);
    expect(b.visibleItemNames()).toEqual(["whole milk"]);
  });
});

describe("disconnecting right after a write", () => {
  // Regression (found by the on-demand fuzzer after #357): the server skipped
  // messages still queued for a socket that was already closing, so a rename
  // sent right before the app closed or lost its connection was dropped. The
  // REST copy of the rename does not notify subscribers, so the other
  // devices never saw it.
  it("delivers a rename sent right before the app restarts", async () => {
    sim = await SyncSim.start();
    const { listId, devices: [a, b] } = await sim.sharedList(2);
    await a.renameActiveList("Groceries");
    await a.restart();
    await sim.waitForConvergence(listId);
    expect(b.listName()).toBe("Groceries");
  });

  it("delivers a rename sent right before the connection drops", async () => {
    sim = await SyncSim.start();
    const { listId, devices: [a, b] } = await sim.sharedList(2);
    await a.renameActiveList("Groceries");
    a.goOffline();
    a.goOnline();
    await sim.waitForConvergence(listId);
    expect(b.listName()).toBe("Groceries");
  });

  // Sanity check only: unlike renames, item edits are also repaired by the
  // hash_diff exchange after reconnect, so this passes even without the fix.
  it("delivers an item edit sent right before the app restarts", async () => {
    sim = await SyncSim.start();
    const { listId, devices: [a, b] } = await sim.sharedList(2);
    await a.addItem("milk");
    await sim.waitForConvergence(listId);
    await a.editItem("milk", "oat milk");
    await a.restart();
    await sim.waitForConvergence(listId);
    expect(b.visibleItemNames()).toEqual(["oat milk"]);
  });
});
