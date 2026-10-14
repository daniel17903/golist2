import type { Page } from "@playwright/test";
import { expect, test } from "./fixtures";

type GridAnimation = { name: string; kind: "enter" | "move" };

// Records every Web Animation started on an item card ("move" = gliding to a
// new grid slot via translate, "enter" = the pop-in), so tests can assert
// on animations without racing their ~250ms duration.
const recordGridAnimations = async (page: Page) => {
  await page.evaluate(() => {
    const log: Array<{ name: string; kind: string }> = [];
    Reflect.set(window, "__gridAnimations", log);
    const originalAnimate = Element.prototype.animate;
    Element.prototype.animate = function (this: Element, keyframes, options) {
      if (this instanceof HTMLElement && this.dataset.itemId) {
        log.push({
          name: this.querySelector(".item-name")?.textContent ?? "",
          kind: JSON.stringify(keyframes).includes("translate") ? "move" : "enter",
        });
      }
      return originalAnimate.call(this, keyframes, options);
    };
  });
  return async (): Promise<GridAnimation[]> => page.evaluate(() => Reflect.get(window, "__gridAnimations"));
};

test.describe("items", () => {
  test("adds an item, parses the quantity and syncs it to the backend", async ({ app, backend }) => {
    await app.waitForRealtimeSync();
    await app.addItem("milk 1L");

    const card = app.itemCard("milk");
    await expect(card).toBeVisible();
    await expect(card.locator(".item-quantity")).toHaveText("1L");
    await expect(card.locator(".item-icon img")).toHaveAttribute("src", /\/icons\/(?!default)[^/]+\.svg$/);

    const deviceId = await app.deviceId();
    const listId = await app.activeListId();
    await expect
      .poll(async () => (await backend.getList(deviceId, listId)).body?.items.map((item) => [item.name, item.quantityOrUnit]))
      .toEqual([["milk", "1L"]]);
  });

  test("parses a leading quantity", async ({ app }) => {
    await app.addItem("2 kg apples");
    await expect(app.itemCard("apples").locator(".item-quantity")).toHaveText("2 kg");
  });

  test("unknown items get the default icon", async ({ app }) => {
    await app.addItem("flux capacitor");
    await expect(app.itemCard("flux capacitor").locator(".item-icon img")).toHaveAttribute("src", "/icons/default.svg");
  });

  test("ignores blank input", async ({ app }) => {
    await app.openAddDialog();
    await app.addItemInput.fill("   ");
    await app.addItemInput.press("Enter");
    await expect(app.addItemInput).toBeVisible();
    await app.page.locator(".add-dialog").click({ position: { x: 5, y: 5 } });
    await expect(app.addItemInput).toBeHidden();
    await expect(app.itemCards).toHaveCount(0);
  });

  test("reopening the add dialog starts empty", async ({ app }) => {
    await app.openAddDialog();
    await app.addItemInput.fill("leftover");
    await app.page.locator(".add-dialog").click({ position: { x: 5, y: 5 } });
    await expect(app.addItemInput).toBeHidden();
    await app.openAddDialog();
    await expect(app.addItemInput).toHaveValue("");
    await expect(app.addItemInput).toBeFocused();
  });

  test("sorts items by grocery category, then by name", async ({ app }) => {
    for (const name of ["water", "zebra cake mix", "milk", "bread", "apples", "bananas"]) {
      await app.addItem(name);
    }
    expect(await app.itemNames()).toEqual(["apples", "bananas", "bread", "milk", "water", "zebra cake mix"]);
  });

  test("persists items across reloads", async ({ app }) => {
    await app.addItem("cheese");
    await app.addItem("bread");
    await app.reload();
    expect(await app.itemNames()).toEqual(["bread", "cheese"]);
  });

  test("checking an item off removes it and syncs the deleted flag", async ({ app, backend }) => {
    await app.waitForRealtimeSync();
    await app.addItem("bread");
    await app.checkOff("bread");

    const deviceId = await app.deviceId();
    const listId = await app.activeListId();
    await expect
      .poll(async () => (await backend.getList(deviceId, listId)).body?.items.map((item) => item.deleted))
      .toEqual([true]);

    await app.reload();
    await expect(app.itemCards).toHaveCount(0);
  });

  test("undo brings a checked-off item back", async ({ app }) => {
    await app.addItem("bread");
    await app.checkOff("bread");
    const toast = app.undoToast('"bread" deleted.');
    await expect(toast).toBeVisible();
    await toast.getByRole("button", { name: "Undo" }).click();
    await expect(app.itemCard("bread")).toBeVisible();
    await expect(toast).toHaveCount(0);
  });

  test("undo toasts expire after a few seconds", async ({ app }) => {
    await app.addItem("bread");
    await app.checkOff("bread");
    await expect(app.undoToast("bread")).toBeVisible();
    await expect(app.undoToast("bread")).toHaveCount(0, { timeout: 8_000 });
  });

  test("stacks at most three undo toasts", async ({ app }) => {
    for (const name of ["apples", "bread", "milk", "water"]) {
      await app.addItem(name);
    }
    for (const name of ["apples", "bread", "milk", "water"]) {
      await app.checkOff(name);
    }
    await expect(app.page.locator(".undo-toast")).toHaveCount(3);
    await expect(app.undoToast("apples")).toHaveCount(0);
  });

  test("suggests previously used items of the list, most frequent first", async ({ app }) => {
    // milk x2, bread x1 — both checked off so they are suggestion candidates.
    for (const name of ["milk", "bread", "milk"]) {
      await app.addItem(name);
      await app.checkOff(name);
    }

    await app.openAddDialog();
    const suggestions = app.page.locator(".add-dialog .item-card .item-name");
    await expect(suggestions).toHaveText(["milk", "bread"]);

    await app.page.locator(".add-dialog .item-card", { hasText: "bread" }).click();
    await expect(app.addItemInput).toBeHidden();
    expect(await app.itemNames()).toEqual(["bread"]);

    // Items that are currently on the list are not suggested again.
    await app.openAddDialog();
    await expect(suggestions).toHaveText(["milk"]);
  });

  test("filters suggestions by the typed text and offers the typed value first", async ({ app }) => {
    for (const name of ["milk", "oat milk", "bread"]) {
      await app.addItem(name);
      await app.checkOff(name);
    }
    await app.openAddDialog();
    await app.addItemInput.fill("mil");
    await expect(app.page.locator(".add-dialog .item-card .item-name")).toHaveText(["mil", "oat milk", "milk"]);
  });

  test("suggestions are scoped to the active list", async ({ app }) => {
    await app.addItem("bread");
    await app.checkOff("bread");
    await app.createList("Hardware");
    await app.openAddDialog();
    await expect(app.page.locator(".add-dialog .item-card")).toHaveCount(0);
  });

  test("warns about duplicates and can add the item again", async ({ app }) => {
    await app.addItem("milk");
    await app.openAddDialog();
    await app.addItemInput.fill("Milk 2L");
    const duplicate = app.page.getByRole("button", { name: "Milk. add again" });
    await expect(duplicate).toBeVisible();
    await duplicate.click();
    await expect(app.addItemInput).toBeHidden();
    await expect(app.itemCards).toHaveCount(2);
  });

  test("long press opens the editor and saves name and quantity", async ({ app, backend }) => {
    await app.waitForRealtimeSync();
    await app.addItem("milk 1L");
    await app.longPress("milk");

    const dialog = app.page.getByRole("dialog");
    await expect(dialog.getByRole("heading", { name: "Edit item" })).toBeVisible();
    await expect(dialog.getByLabel("Name")).toHaveValue("milk");
    await expect(dialog.getByLabel("Quantity")).toHaveValue("1L");

    await dialog.getByLabel("Name").fill("cheese");
    await dialog.getByLabel("Quantity").fill("200 g");
    await dialog.getByRole("button", { name: "Save" }).click();
    await expect(dialog).toHaveCount(0);

    // Long press must not also check the item off.
    const card = app.itemCard("cheese");
    await expect(card).toBeVisible();
    await expect(card.locator(".item-quantity")).toHaveText("200 g");
    await expect(app.itemCard("milk")).toHaveCount(0);

    const deviceId = await app.deviceId();
    const listId = await app.activeListId();
    await expect
      .poll(async () => (await backend.getList(deviceId, listId)).body?.items.map((item) => [item.name, item.quantityOrUnit, item.category]))
      .toEqual([["cheese", "200 g", "milkCheese"]]);
  });

  test("editing can be cancelled", async ({ app }) => {
    await app.addItem("milk");
    await app.longPress("milk");
    const dialog = app.page.getByRole("dialog");
    await dialog.getByLabel("Name").fill("changed");
    await dialog.getByRole("button", { name: "Cancel" }).click();
    expect(await app.itemNames()).toEqual(["milk"]);
  });

  test("clearing the quantity in the editor removes it", async ({ app }) => {
    await app.addItem("milk 1L");
    await app.longPress("milk");
    const dialog = app.page.getByRole("dialog");
    await dialog.getByLabel("Quantity").fill("");
    await dialog.getByRole("button", { name: "Save" }).click();
    await expect(app.itemCard("milk").locator(".item-quantity")).toHaveCount(0);
  });

  test("an empty name in the editor does not wipe the item", async ({ app }) => {
    await app.addItem("milk");
    await app.longPress("milk");
    const dialog = app.page.getByRole("dialog");
    await dialog.getByLabel("Name").fill("   ");
    await dialog.getByRole("button", { name: "Save" }).click();
    await expect(app.itemCards).toHaveCount(1);
    await expect(app.itemCards.first().locator(".item-name")).not.toHaveText(/^\s*$/);
  });

  test.describe("grid animations", () => {
    test("new cards pop in and the remaining cards glide into place after a check-off", async ({ app }) => {
      for (const name of ["apples", "bananas", "bread"]) {
        await app.addItem(name);
      }
      const gridAnimations = await recordGridAnimations(app.page);

      await app.addItem("milk");
      await expect.poll(gridAnimations).toEqual([{ name: "milk", kind: "enter" }]);

      await app.checkOff("apples");
      await expect
        .poll(async () => (await gridAnimations()).filter((entry) => entry.kind === "move").map((entry) => entry.name))
        .toEqual(["bananas", "bread", "milk"]);
      expect(await app.itemNames()).toEqual(["bananas", "bread", "milk"]);
    });

    test("switching lists does not animate the grid", async ({ app }) => {
      await app.addItem("apples");
      await app.createList("Hardware store");
      await app.addItem("nails");
      const gridAnimations = await recordGridAnimations(app.page);

      await app.selectList("Shopping list");
      await expect(app.itemCard("apples")).toBeVisible();
      await app.selectList("Hardware store");
      await expect(app.itemCard("nails")).toBeVisible();
      expect(await gridAnimations()).toEqual([]);
    });

    test.describe("with reduced motion", () => {
      test.use({ contextOptions: { reducedMotion: "reduce" } });

      test("the grid does not animate", async ({ app }) => {
        await app.addItem("apples");
        await app.addItem("bananas");
        const gridAnimations = await recordGridAnimations(app.page);

        await app.addItem("bread");
        await app.checkOff("apples");
        expect(await app.itemNames()).toEqual(["bananas", "bread"]);
        expect(await gridAnimations()).toEqual([]);
      });
    });
  });
});
