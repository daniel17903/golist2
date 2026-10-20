import { expect, test } from "./fixtures";
import type { GoListApp } from "./support/goListApp";
import { shareActiveList } from "./support/multiDevice";

const iphoneUserAgent =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1";

const iphone = { contextOptions: { userAgent: iphoneUserAgent } };

// Makes the device behave like GoList launched from the iOS home screen.
const runAsHomeScreenApp = async (device: GoListApp) => {
  await device.page.addInitScript(() => {
    Object.defineProperty(window.navigator, "standalone", { configurable: true, value: true });
  });
};

const pasteIntoClipboard = async (device: GoListApp, text: string) => {
  await device.page.evaluate((value) => navigator.clipboard.writeText(value), text);
};

test.describe("invite links on iOS", () => {
  test("a link opened in iOS Safari offers to copy the invite for the home-screen app", async ({ app, newDevice }) => {
    await app.renameActiveList("Family groceries");
    await app.addItem("bread");
    const link = await shareActiveList(app);

    const safari = await newDevice(iphone);
    await safari.goto(`/${new URL(link).search}`);
    const landing = safari.page.getByRole("dialog");
    await expect(landing.getByRole("heading", { name: "Join shared list" })).toBeVisible();
    await expect(landing.getByText("Open GoList from your home screen.")).toBeVisible();
    await expect.poll(() => safari.page.url()).not.toContain("shareToken");
    // Nothing is joined in the browser's storage.
    await expect(safari.listTitle).toHaveText("Shopping list");

    await landing.getByRole("button", { name: "Copy invite" }).click();
    await expect(landing.getByRole("button", { name: "Copied ✓" })).toBeVisible();
    expect((await safari.copiedTexts()).at(-1)).toBe(link);

    // The home-screen app has separate storage and clipboard mocks per
    // context, so hand the copied link over explicitly.
    const homeScreenApp = await newDevice(iphone);
    await runAsHomeScreenApp(homeScreenApp);
    await homeScreenApp.goto();
    await pasteIntoClipboard(homeScreenApp, link);
    await homeScreenApp.openDrawer();
    await homeScreenApp.drawer.getByRole("button", { name: "Join list" }).click();
    await homeScreenApp.page.getByRole("dialog").getByRole("button", { name: "Paste from clipboard" }).click();
    await expect(homeScreenApp.page.getByRole("dialog")).toHaveCount(0);
    await expect(homeScreenApp.listTitle).toHaveText("Family groceries");
    await expect(homeScreenApp.itemCard("bread")).toBeVisible();
  });

  test("the iOS invite screen can join right in the browser", async ({ app, newDevice }) => {
    await app.renameActiveList("Family groceries");
    const link = await shareActiveList(app);

    const safari = await newDevice(iphone);
    await safari.goto(`/${new URL(link).search}`);
    await safari.page.getByRole("dialog").getByRole("button", { name: "Use in browser" }).click();
    await expect(safari.page.getByRole("dialog")).toHaveCount(0);
    await expect(safari.listTitle).toHaveText("Family groceries");
  });

  test("dismissing the iOS invite screen does not join", async ({ app, newDevice }) => {
    await app.renameActiveList("Family groceries");
    const link = await shareActiveList(app);

    const safari = await newDevice(iphone);
    await safari.goto(`/${new URL(link).search}`);
    await expect(safari.page.getByRole("dialog")).toBeVisible();
    await safari.page.getByRole("dialog").click({ position: { x: 200, y: 5 } });
    await expect(safari.page.getByRole("dialog")).toHaveCount(0);
    await expect(safari.listTitle).toHaveText("Shopping list");
  });

  test("a link opened inside the home-screen app joins directly", async ({ app, newDevice }) => {
    await app.renameActiveList("Family groceries");
    const link = await shareActiveList(app);

    const homeScreenApp = await newDevice(iphone);
    await runAsHomeScreenApp(homeScreenApp);
    await homeScreenApp.goto(`/${new URL(link).search}`);
    await expect(homeScreenApp.listTitle).toHaveText("Family groceries");
    await expect(homeScreenApp.page.getByRole("dialog")).toHaveCount(0);
  });
});

test.describe("join dialog paste button", () => {
  test("joins with a link from the clipboard in one tap", async ({ app, newDevice }) => {
    await app.renameActiveList("Family groceries");
    const link = await shareActiveList(app);

    const device = await newDevice();
    await device.goto();
    await pasteIntoClipboard(device, `Join my list: ${link}`);
    await device.openDrawer();
    await device.drawer.getByRole("button", { name: "Join list" }).click();
    await device.page.getByRole("dialog").getByRole("button", { name: "Paste from clipboard" }).click();
    await expect(device.listTitle).toHaveText("Family groceries");
  });

  test("explains when the clipboard holds no invite link", async ({ app }) => {
    await pasteIntoClipboard(app, "milk, eggs");
    await app.openDrawer();
    await app.drawer.getByRole("button", { name: "Join list" }).click();
    const dialog = app.page.getByRole("dialog");
    await dialog.getByRole("button", { name: "Paste from clipboard" }).click();
    await expect(dialog.getByRole("alert")).toHaveText("No invite link found in the clipboard.");
    await expect(dialog.getByRole("button", { name: "Join", exact: true })).toBeDisabled();
  });
});
