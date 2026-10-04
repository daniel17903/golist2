import { expect, test } from "./fixtures";

test.describe("lists", () => {
  test("creates a default list on first launch and registers it with the backend", async ({ app, backend }) => {
    await expect(app.listTitle).toHaveText("Shopping list");
    await app.waitForRealtimeSync();

    const listId = await app.activeListId();
    const deviceId = await app.deviceId();
    await expect.poll(async () => (await backend.getList(deviceId, listId)).body?.name).toBe("Shopping list");
  });

  test("creates only one default list even after reloads", async ({ app }) => {
    await app.reload();
    await app.reload();
    await app.openDrawer();
    await expect(app.drawerListNames()).toHaveText(["Shopping list"]);
  });

  test("creates, switches and remembers the selected list across reloads", async ({ app, backend }) => {
    await app.createList("Hardware store");
    await app.openDrawer();
    await expect(app.drawerListNames()).toHaveText(["Shopping list", "Hardware store"]);
    await app.page.keyboard.press("Escape");

    const deviceId = await app.deviceId();
    const listId = await app.activeListId();
    await expect.poll(async () => (await backend.getList(deviceId, listId)).body?.name).toBe("Hardware store");

    await app.reload();
    await expect(app.listTitle).toHaveText("Hardware store");

    await app.selectList("Shopping list");
    await app.reload();
    await expect(app.listTitle).toHaveText("Shopping list");
  });

  test("keeps items scoped to their list", async ({ app }) => {
    await app.addItem("milk");
    await app.createList("Party");
    await expect(app.itemCards).toHaveCount(0);
    await app.addItem("chips");
    await app.selectList("Shopping list");
    expect(await app.itemNames()).toEqual(["milk"]);
    await app.selectList("Party");
    expect(await app.itemNames()).toEqual(["chips"]);
  });

  test("does not offer the create button for a blank name", async ({ app }) => {
    await app.openDrawer();
    await app.drawer.getByRole("button", { name: "Create new list" }).click();
    const dialog = app.page.getByRole("dialog");
    await expect(dialog.getByRole("button", { name: "Create" })).toBeDisabled();
    await dialog.getByRole("textbox", { name: "Name" }).fill("   ");
    await expect(dialog.getByRole("button", { name: "Create" })).toBeDisabled();
    await dialog.getByRole("button", { name: "Cancel" }).click();
    await expect(dialog).toHaveCount(0);
  });

  test.describe("inline rename", () => {
    test("renames with Enter and syncs the new name to the backend", async ({ app, backend }) => {
      await app.waitForRealtimeSync();
      await app.renameActiveList("Weekly groceries");

      const deviceId = await app.deviceId();
      const listId = await app.activeListId();
      await expect.poll(async () => (await backend.getList(deviceId, listId)).body?.name).toBe("Weekly groceries");

      await app.reload();
      await expect(app.listTitle).toHaveText("Weekly groceries");
    });

    test("cancels with Escape", async ({ app }) => {
      await app.listTitle.click();
      const input = app.page.getByRole("textbox", { name: "List name" });
      await input.fill("Discarded");
      await input.press("Escape");
      await expect(app.listTitle).toHaveText("Shopping list");
    });

    test("saves on blur", async ({ app }) => {
      await app.listTitle.click();
      const input = app.page.getByRole("textbox", { name: "List name" });
      await input.fill("Blurred name");
      await input.blur();
      await expect(app.listTitle).toHaveText("Blurred name");
    });

    test("trims whitespace and ignores an empty name", async ({ app }) => {
      await app.listTitle.click();
      const input = app.page.getByRole("textbox", { name: "List name" });
      await input.fill("   ");
      await input.press("Enter");
      // Still editing: an empty name is never saved.
      await expect(input).toBeVisible();
      await input.fill("  Padded  ");
      await input.press("Enter");
      await expect(app.listTitle).toHaveText("Padded");
    });

    test("can be undone from the toast", async ({ app }) => {
      await app.renameActiveList("Temporary");
      const toast = app.undoToast('List renamed to "Temporary".');
      await expect(toast).toBeVisible();
      await toast.getByRole("button", { name: "Undo" }).click();
      await expect(app.listTitle).toHaveText("Shopping list");
      await expect(toast).toHaveCount(0);
    });

    test("undo restores the name on the backend as well", async ({ app, backend }) => {
      await app.waitForRealtimeSync();
      await app.renameActiveList("Temporary");
      await app.undoToast("Temporary").getByRole("button", { name: "Undo" }).click();

      const deviceId = await app.deviceId();
      const listId = await app.activeListId();
      await expect.poll(async () => (await backend.getList(deviceId, listId)).body?.name).toBe("Shopping list");
    });
  });

  test.describe("delete", () => {
    test("cannot delete the last remaining list", async ({ app }) => {
      await app.openDrawer();
      await expect(app.drawer.getByRole("button", { name: "Delete: Shopping list" })).toBeDisabled();
    });

    test("requires a confirmation tap and switches to the remaining list", async ({ app }) => {
      await app.addItem("bread");
      await app.createList("Old list");
      await app.addItem("apples");

      await app.openDrawer();
      await app.drawer.getByRole("button", { name: "Delete: Old list" }).click();
      await expect(app.drawer.getByText('Tap again to delete "Old list".')).toBeVisible();
      await app.drawer.getByRole("button", { name: "Confirm delete: Old list" }).click();

      await expect(app.listTitle).toHaveText("Shopping list");
      expect(await app.itemNames()).toEqual(["bread"]);

      await app.reload();
      await app.openDrawer();
      await expect(app.drawerListNames()).toHaveText(["Shopping list"]);
    });
  });
});
