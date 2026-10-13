import { afterEach, describe, expect, it } from "vitest";
import { SyncSim, delay } from "../harness";

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
      return true;
    };

    await a.editItem("milk", "whole milk");
    await delay(50);
    await localEdit;
    await sim.waitForConvergence(listId);

    expect(a.visibleItemNames()).toEqual(["oat milk"]);
    expect((await b.persistedItems(listId)).map((item) => item.name)).toEqual(["oat milk"]);
  });
});

describe("server message ordering", () => {
  // Regression (found by the sync fuzzer, shrunk from seed 99): a rename made
  // while the device was mid full-sync pass reached the server over REST,
  // but its WebSocket list_metadata_patch was processed concurrently with a
  // re-subscribe and dropped ("not subscribed to list"). REST does not
  // notify subscribers, so the other device never saw the rename.
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
