import { afterEach, describe, expect, it } from "vitest";
import { SyncSim } from "../harness";

let sim: SyncSim;
afterEach(async () => {
  await sim?.dispose();
});

describe("sim smoke", () => {
  it("propagates an item between two devices", async () => {
    sim = await SyncSim.start();
    const { listId, devices: [a, b] } = await sim.sharedList(2);
    await a.addItem("milk", "1L");
    await sim.waitForConvergence(listId);
    expect(b.visibleItemNames()).toEqual(["milk"]);
    expect(b.item("milk")?.quantityOrUnit).toBe("1L");
  });
});
