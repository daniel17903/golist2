import { expect, test } from "./fixtures";
import { shareAcross } from "./support/multiDevice";

// `yyyy-mm-dd` of today + `offset` days (local time, like the date input).
const dayInput = (offset: number) => {
  const date = new Date();
  date.setDate(date.getDate() + offset);
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
};

test.describe("todo lists", () => {
  test("creates a todo list and stores todos with their details on the backend", async ({ app, backend }) => {
    await app.createList("Chores", { listType: "todo" });
    await expect(app.page.getByText("Nothing to do. Add a todo with +.")).toBeVisible();

    await app.addTodo({ title: "Take out trash", dueDate: dayInput(1), assignedTo: "Alex", points: 3, description: "Both bins" });
    await app.addTodo({ title: "Water plants" });

    const trash = app.todoRow("Take out trash");
    await expect(trash.locator(".todo-item__due-date")).toHaveText("Tomorrow");
    await expect(trash.locator(".todo-item__assigned-to")).toHaveText("Alex");
    // Todos with a due date come first.
    expect(await app.todoTitles()).toEqual(["Take out trash", "Water plants"]);
    await expect(app.itemCards).toHaveCount(0);

    const deviceId = await app.deviceId();
    const listId = await app.activeListId();
    await expect
      .poll(async () => {
        const remote = (await backend.getList(deviceId, listId)).body;
        const item = remote?.items.find((entry) => entry.name === "Take out trash");
        return { listType: remote?.listType, assignedTo: item?.assignedTo, points: item?.points, description: item?.description, hasDue: Boolean(item?.dueDate) };
      })
      .toEqual({ listType: "todo", assignedTo: "Alex", points: 3, description: "Both bins", hasDue: true });

    await app.reload();
    await expect(app.listTitle).toHaveText("Chores");
    expect(await app.todoTitles()).toEqual(["Take out trash", "Water plants"]);
  });

  test("completing a todo hides it, and undo brings it back", async ({ app, backend }) => {
    await app.createList("Chores", { listType: "todo" });
    await app.addTodo({ title: "Vacuum" });
    await app.completeTodo("Vacuum");

    const deviceId = await app.deviceId();
    const listId = await app.activeListId();
    await expect
      .poll(async () => {
        const item = (await backend.getList(deviceId, listId)).body?.items.find((entry) => entry.name === "Vacuum");
        return { completed: Boolean(item?.completedAt), deleted: item?.deleted };
      })
      .toEqual({ completed: true, deleted: false });

    await app.undoToast('"Vacuum" completed.').getByRole("button", { name: "Undo" }).click();
    await expect(app.todoRow("Vacuum")).toHaveCount(1);
    await expect
      .poll(async () => Boolean((await backend.getList(deviceId, listId)).body?.items.find((entry) => entry.name === "Vacuum")?.completedAt))
      .toBe(false);
  });

  test("completing a recurring todo creates its next occurrence; undo removes it again", async ({ app }) => {
    await app.createList("Chores", { listType: "todo" });
    await app.addTodo({ title: "Mop floor", dueDate: dayInput(0), repeatEveryWeek: true });
    await expect(app.todoRow("Mop floor").locator(".todo-item__recurrence")).toBeVisible();

    await app.todoRow("Mop floor").click();
    // The completed instance slides out, the next one (due in a week) stays.
    await expect(app.todoRows).toHaveCount(1);
    await expect(app.todoRow("Mop floor").locator(".todo-item__due-date")).not.toHaveText("Today");

    await app.undoToast('"Mop floor" completed.').getByRole("button", { name: "Undo" }).click();
    await expect(app.todoRows).toHaveCount(1);
    await expect(app.todoRow("Mop floor").locator(".todo-item__due-date")).toHaveText("Today");
  });

  test("edits and deletes a todo from the long-press dialog", async ({ app }) => {
    await app.createList("Chores", { listType: "todo" });
    await app.addTodo({ title: "Call landlord" });
    await app.editTodo("Call landlord", { title: "Call landlord about heating", assignedTo: "Sam" });
    await expect(app.todoRow("Call landlord about heating").locator(".todo-item__assigned-to")).toHaveText("Sam");

    await app.openTodo("Call landlord about heating");
    await app.page.getByRole("dialog").getByRole("button", { name: "Delete" }).click();
    await expect(app.todoRows).toHaveCount(0);
    await app.undoToast('"Call landlord about heating" deleted.').getByRole("button", { name: "Undo" }).click();
    await expect(app.todoRows).toHaveCount(1);
  });

  test("the stats button shows points per person for todo lists", async ({ app }) => {
    await app.createList("Chores", { listType: "todo" });
    await app.addTodo({ title: "Clean bathroom", dueDate: dayInput(0), assignedTo: "Alex", points: 5 });
    await app.completeTodo("Clean bathroom");

    await app.page.getByRole("button", { name: "Open list statistics" }).click();
    const dialog = app.page.getByRole("dialog");
    await expect(dialog.getByRole("heading", { name: "List statistics" })).toBeVisible();
    const card = dialog.locator(".stats-card", { hasText: "Alex" });
    await expect(card.locator(".stats-row--overall .stats-row__value")).toHaveText("5");
    await expect(card.locator(".stats-row--this-week .stats-row__value")).toHaveText("5 / 5");
  });

  test("switching a list's type keeps its open entries", async ({ app, backend }) => {
    await app.addItem("milk");
    await app.addItem("bread");
    await app.checkOff("bread");

    await app.setActiveListType("todo");
    expect(await app.todoTitles()).toEqual(["milk"]);
    await app.addTodo({ title: "Buy flowers" });
    await app.completeTodo("milk");

    await app.setActiveListType("shopping");
    // Completed todos stay hidden in the grid too.
    expect((await app.itemNames()).sort()).toEqual(["Buy flowers"]);

    const deviceId = await app.deviceId();
    const listId = await app.activeListId();
    await expect.poll(async () => (await backend.getList(deviceId, listId)).body?.listType).toBe("shopping");
  });

  test("a shared todo list syncs its type, todos and completions to other devices", async ({ app, newDevice }) => {
    await app.createList("Flat chores", { listType: "todo" });
    await app.addTodo({ title: "Buy toilet paper", assignedTo: "Kim" });
    const [, other] = await shareAcross(app, newDevice, 1);

    await expect(other.todoRow("Buy toilet paper").locator(".todo-item__assigned-to")).toHaveText("Kim");
    await other.addTodo({ title: "Descale kettle", dueDate: dayInput(2) });
    await expect(app.todoRow("Descale kettle")).toHaveCount(1);

    await app.completeTodo("Buy toilet paper");
    await expect(other.todoRow("Buy toilet paper")).toHaveCount(0);

    await other.setActiveListType("shopping");
    await expect(app.itemCard("Descale kettle")).toHaveCount(1);
    await expect(app.todoRows).toHaveCount(0);
  });
});
