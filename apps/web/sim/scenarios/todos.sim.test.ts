import { afterEach, describe, expect, it } from "vitest";
import { SyncSim } from "../harness";

// Todo-type lists share the item sync with shopping lists; these scenarios
// cover what is specific to them: the list type as part of the list
// metadata, the todo fields as part of the item hash, and completion.

let sim: SyncSim;
afterEach(async () => {
  await sim?.dispose();
});

const weekly = JSON.stringify({ every: 1, unit: "week", anchor: "from_due_date" });

describe("todo lists", () => {
  it("propagates the list type, todos, edits and completions", async () => {
    sim = await SyncSim.start();
    const { listId, devices: [a, b] } = await sim.sharedList(2);

    await a.setActiveListType("todo");
    await a.addTodo("Vacuum", { assignedTo: "Alex", points: 2 });
    await sim.waitForConvergence(listId);
    expect(b.listType()).toBe("todo");
    expect(b.item("Vacuum")).toMatchObject({ assignedTo: "Alex", points: 2 });

    await b.editTodo("Vacuum", { title: "Vacuum", assignedTo: "Kim", description: "Living room" });
    await sim.waitForConvergence(listId);
    expect(a.item("Vacuum")).toMatchObject({ assignedTo: "Kim", description: "Living room" });
    // Unset fields are cleared, not kept from the previous version.
    expect(a.item("Vacuum")?.points).toBeUndefined();

    await a.completeTodo("Vacuum");
    await sim.waitForConvergence(listId);
    expect(b.openTodoTitles()).toEqual([]);
    expect(b.item("Vacuum")?.completedAt).toBeTypeOf("number");
  });

  it("completing a recurring todo syncs the next occurrence, and undo removes it everywhere", async () => {
    sim = await SyncSim.start();
    const { listId, devices: [a, b] } = await sim.sharedList(2);
    await a.setActiveListType("todo");
    const dueDate = sim.clock.now();
    await a.addTodo("Mop", { dueDate, recurrence: weekly });
    await sim.waitForConvergence(listId);

    const completion = await b.completeTodo("Mop");
    expect(completion.spawnedItemId).toBeDefined();
    await sim.waitForConvergence(listId);
    const next = a.itemsOf(listId).find((item) => item.id === completion.spawnedItemId);
    expect(next).toMatchObject({ name: "Mop", recurrence: weekly, deleted: false });
    expect(next!.completedAt).toBeUndefined();
    expect(next!.dueDate).toBeGreaterThan(dueDate);

    await b.undoCompleteTodo(completion);
    await sim.waitForConvergence(listId);
    expect(a.openTodoTitles()).toEqual(["Mop"]);
    expect(a.itemsOf(listId).find((item) => item.id === completion.spawnedItemId)?.deleted).toBe(true);
  });

  it("concurrent offline type switch and rename converge on the newer metadata", async () => {
    sim = await SyncSim.start();
    const { listId, devices: [a, b] } = await sim.sharedList(2);

    a.goOffline();
    b.goOffline();
    await a.setActiveListType("todo");
    sim.clock.advance(10);
    await b.renameActiveList("Household");
    a.goOnline();
    b.goOnline();
    await sim.waitForConvergence(listId);

    // One metadata record: the later write (b's rename) carries b's type.
    for (const device of [a, b]) {
      expect(device.listName(listId)).toBe("Household");
      expect(device.listType(listId)).toBe("shopping");
    }
  });

  it("offline todo edits on two devices converge after reconnect", async () => {
    sim = await SyncSim.start();
    const { listId, devices: [a, b] } = await sim.sharedList(2);
    await a.setActiveListType("todo");
    await a.addTodo("Call landlord");
    await sim.waitForConvergence(listId);

    a.goOffline();
    b.goOffline();
    await a.editTodo("Call landlord", { title: "Call landlord", assignedTo: "Alex" });
    sim.clock.advance(5);
    await b.completeTodo("Call landlord");
    a.goOnline();
    b.goOnline();
    await sim.waitForConvergence(listId);

    // Last write wins per item: b's completion is newer than a's edit.
    expect(a.openTodoTitles()).toEqual([]);
    expect(a.item("Call landlord")?.assignedTo).toBeUndefined();
  });
});
