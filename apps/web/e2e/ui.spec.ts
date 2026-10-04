import { expect, test } from "./fixtures";

test.describe("settings and i18n", () => {
  test("switching the language in settings translates the UI and persists", async ({ app }) => {
    await app.openDrawer();
    await app.drawer.getByRole("button", { name: "Settings" }).click();
    const dialog = app.page.getByRole("dialog");
    await expect(dialog.getByRole("heading", { name: "Settings" })).toBeVisible();
    await dialog.getByLabel("Language").selectOption("de");

    await expect(dialog.getByRole("heading", { name: "Einstellungen" })).toBeVisible();
    await dialog.getByRole("button", { name: "Schließen" }).click();
    await expect(app.page.getByRole("button", { name: "Eintrag hinzufügen" })).toBeVisible();
    await expect(app.page.locator("html")).toHaveAttribute("lang", "de");

    await app.page.reload();
    await expect(app.page.getByRole("button", { name: "Eintrag hinzufügen" })).toBeVisible();
  });

  test.describe("with a German browser", () => {
    test.use({ locale: "de-DE" });

    test("detects the browser language and names the default list accordingly", async ({ page }) => {
      await page.goto("/");
      await expect(page.getByRole("button", { name: "Listenname bearbeiten" })).toHaveText("Einkaufsliste");
      await expect(page.locator("html")).toHaveAttribute("lang", "de");
    });

    test("maps German item names to categories and icons", async ({ page }) => {
      await page.goto("/");
      await page.getByRole("button", { name: "Eintrag hinzufügen" }).click();
      const input = page.getByRole("textbox", { name: "Eintragsname" });
      await input.fill("Milch 1 Liter");
      await input.press("Enter");
      const card = page.locator("main.list-grid .item-card", { hasText: "Milch" });
      await expect(card.locator(".item-quantity")).toHaveText("1 Liter");
      await expect(card.locator(".item-icon img")).not.toHaveAttribute("src", "/icons/default.svg");
    });
  });

  test("the ?lang= URL parameter selects the language", async ({ page }) => {
    await page.goto("/?lang=es");
    await expect(page.getByRole("button", { name: "Editar nombre de lista" })).toHaveText("Lista de compras");
  });
});

test.describe("language suggestion", () => {
  test.use({ initOptions: { suppressLanguageSuggestion: false } });

  test("offers to switch when recent items match another language and recategorizes them", async ({ app }) => {
    await app.addItem("Brot");
    await expect(app.itemCard("Brot").locator(".item-icon img")).toHaveAttribute("src", "/icons/default.svg");
    await app.addItem("Milch");

    const dialog = app.page.getByRole("dialog");
    await expect(dialog.getByRole("heading", { name: "Switch app language?" })).toBeVisible();
    await expect(dialog).toContainText("German");
    await dialog.getByRole("button", { name: "Switch language" }).click();

    await expect(app.page.getByRole("button", { name: "Eintrag hinzufügen" })).toBeVisible();
    await expect(app.page.locator("main.list-grid .item-card", { hasText: "Brot" }).locator(".item-icon img"))
      .not.toHaveAttribute("src", "/icons/default.svg");
    // Recategorized: bread sorts before milk products.
    expect(await app.itemNames()).toEqual(["Brot", "Milch"]);
  });

  test("is not offered again after being dismissed", async ({ app }) => {
    await app.addItem("Brot");
    await app.addItem("Milch");
    const dialog = app.page.getByRole("dialog");
    await dialog.getByRole("button", { name: "Keep current language" }).click();
    await expect(dialog).toHaveCount(0);

    await app.reload();
    await app.addItem("Käse");
    await expect(app.page.getByRole("dialog")).toHaveCount(0);
    await expect(app.page.getByRole("button", { name: "Add item" })).toBeVisible();
  });
});

test.describe("list statistics", () => {
  test("shows totals and the most added items", async ({ app }) => {
    await app.addItem("milk");
    await app.addItem("bread");
    await app.addItem("milk 2L");

    await app.page.getByRole("button", { name: "Open list statistics" }).click();
    const dialog = app.page.getByRole("dialog");
    await expect(dialog.getByRole("heading", { name: "List stats" })).toBeVisible();
    const summary = dialog.getByRole("list", { name: "List statistics summary" });
    await expect(summary.getByRole("listitem").filter({ hasText: "Items ever added" })).toContainText("3");
    await expect(summary.getByRole("listitem").filter({ hasText: "Open items" })).toContainText("3");
    await expect(dialog.locator(".list-stats-modal__top-items li").first()).toContainText("milk");
    await expect(dialog.locator(".list-stats-modal__top-items li").first()).toContainText("2x");

    await dialog.getByRole("button", { name: "Close" }).click();
    await expect(dialog).toHaveCount(0);
  });

  test("an empty list shows placeholders", async ({ app }) => {
    await app.page.getByRole("button", { name: "Open list statistics" }).click();
    const dialog = app.page.getByRole("dialog");
    await expect(dialog.getByText("No data yet")).toHaveCount(2);
  });
});

test.describe("legal pages", () => {
  for (const [label, heading] of [["Imprint", "Contact"], ["Privacy policy", /Privacy/]] as const) {
    test(`opens the ${label} from the drawer`, async ({ app }) => {
      await app.openDrawer();
      await app.drawer.getByRole("button", { name: label }).click();
      const dialog = app.page.getByRole("dialog");
      await expect(dialog.getByRole("heading", { name: heading }).first()).toBeVisible();
      await expect(app.page.locator(".drawer.drawer--open")).toHaveCount(0);
      await dialog.getByRole("button", { name: "Close" }).click();
      await expect(dialog).toHaveCount(0);
    });
  }
});

test.describe("popups and back gesture", () => {
  test("the drawer closes via its backdrop", async ({ app }) => {
    await app.openDrawer();
    await app.page.locator(".drawer-backdrop").click({ position: { x: 370, y: 400 } });
    await expect(app.page.locator(".drawer.drawer--open")).toHaveCount(0);
  });

  test("back closes the topmost popup instead of leaving the app", async ({ app }) => {
    const appUrl = app.page.url();
    await app.openDrawer();
    await app.drawer.getByRole("button", { name: "Settings" }).click();
    await expect(app.page.getByRole("dialog")).toBeVisible();

    await app.page.goBack();
    await expect(app.page.getByRole("dialog")).toHaveCount(0);
    expect(app.page.url()).toBe(appUrl);

    await app.openDrawer();
    await app.page.goBack();
    await expect(app.page.locator(".drawer.drawer--open")).toHaveCount(0);

    await app.openAddDialog();
    await app.page.goBack();
    await expect(app.addItemInput).toBeHidden();

    // With nothing open, back stays in the app.
    await app.page.goBack();
    await expect(app.listTitle).toBeVisible();
    expect(app.page.url()).toBe(appUrl);
  });

  test("back peels stacked popups off one at a time", async ({ app }) => {
    await app.addItem("milk");
    await app.openDrawer();
    await app.drawer.getByRole("button", { name: "Create new list" }).click();
    await expect(app.page.getByRole("heading", { name: "Create new list" })).toBeVisible();
    await app.page.goBack();
    await expect(app.page.getByRole("dialog")).toHaveCount(0);
    await expect(app.listTitle).toHaveText("Shopping list");
  });
});

test.describe("joining failures", () => {
  test("joining with an unknown token tells the user it failed", async ({ app }) => {
    await app.waitForRealtimeSync();
    await app.joinList("0b6f2c1e-4b8a-4f3e-9c2d-7a1b2c3d4e5f");
    await expect(app.page.getByText(/Shared list could not be loaded/)).toBeVisible();
    await expect(app.listTitle).toHaveText("Shopping list");
  });

  test("an unknown share token in the URL tells the user it failed and keeps the app usable", async ({ app }) => {
    await app.page.goto("/?shareToken=0b6f2c1e-4b8a-4f3e-9c2d-7a1b2c3d4e5f");
    await expect(app.page.getByText(/Shared list could not be loaded/)).toBeVisible();
    await expect(app.listTitle).toHaveText("Shopping list");
    await expect.poll(() => app.page.url()).not.toContain("shareToken");
  });
});
