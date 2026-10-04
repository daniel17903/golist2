import { expect, test } from "./fixtures";
import { backendUrl } from "./support/backendApi";
import type { GoListApp } from "./support/goListApp";

const shareTokenPattern = /\?shareToken=([0-9a-f-]{36})$/;

// Device A shares its active list; returns the copied share link.
const shareActiveList = async (app: GoListApp) => {
  await app.waitForRealtimeSync();
  await app.page.getByRole("button", { name: "Share list" }).click();
  await expect(app.page.getByText("Share link copied to clipboard.")).toBeVisible();
  const link = (await app.copiedTexts()).at(-1);
  expect(link).toMatch(shareTokenPattern);
  return link!;
};

// Opens the share link on a fresh device and waits until it shows the list.
const openSharedLink = async (device: GoListApp, link: string, listName: string) => {
  await device.page.goto(new URL(link).search ? `/${new URL(link).search}` : link);
  await expect(device.listTitle).toHaveText(listName);
  await device.waitForRealtimeSync();
};

test.describe("sharing and realtime sync", () => {
  test("share button copies a share link for the active list", async ({ app }) => {
    const link = await shareActiveList(app);
    expect(link.startsWith(app.page.url().replace(/\/$/, ""))).toBe(true);

    // The token grants a fresh device access to the list.
    const token = shareTokenPattern.exec(link)![1];
    const listId = await app.activeListId();
    const response = await fetch(`${backendUrl}/v1/share-tokens/${token}/redeem`, {
      method: "POST",
      headers: { "x-device-id": crypto.randomUUID(), Origin: "http://127.0.0.1" },
    });
    expect(await response.json()).toEqual({ listId });
  });

  test("opening a share link joins the list with its items and cleans the URL", async ({ app, newDevice }) => {
    await app.renameActiveList("Family groceries");
    await app.addItem("milk 1L");
    await app.addItem("bread");
    const link = await shareActiveList(app);

    const device = await newDevice();
    await openSharedLink(device, link, "Family groceries");
    expect(await device.itemNames()).toEqual(["bread", "milk"]);
    await expect(device.itemCard("milk").locator(".item-quantity")).toHaveText("1L");
    expect(device.page.url()).not.toContain("shareToken");

    // The joining device keeps its own default list too.
    await device.openDrawer();
    await expect(device.drawerListNames()).toHaveText(["Family groceries", "Shopping list"].sort());
  });

  test("joins via the join dialog using a pasted link or a bare token", async ({ app, newDevice }) => {
    await app.addItem("bread");
    const link = await shareActiveList(app);
    const token = shareTokenPattern.exec(link)![1];

    const viaLink = await newDevice();
    await viaLink.goto();
    await viaLink.joinList(link);
    await expect(viaLink.page.getByRole("dialog")).toHaveCount(0);
    await expect(viaLink.itemCard("bread")).toBeVisible();

    const viaToken = await newDevice();
    await viaToken.goto();
    await viaToken.joinList(`  ${token}  `);
    await expect(viaToken.itemCard("bread")).toBeVisible();
    await viaToken.reload();
    await expect(viaToken.itemCard("bread")).toBeVisible();
  });

  test("join dialog only enables Join for something that looks like a token", async ({ app }) => {
    await app.openDrawer();
    await app.drawer.getByRole("button", { name: "Join list" }).click();
    const dialog = app.page.getByRole("dialog");
    const input = dialog.getByRole("textbox", { name: "Share token or link" });
    await expect(dialog.getByRole("button", { name: "Join" })).toBeDisabled();
    await input.fill("not a token");
    await expect(dialog.getByRole("button", { name: "Join" })).toBeDisabled();
    await input.fill("https://go-list.app/?shareToken=0b6f2c1e-4b8a-4f3e-9c2d-7a1b2c3d4e5f");
    await expect(dialog.getByRole("button", { name: "Join" })).toBeEnabled();
  });

  test("propagates items between devices in realtime", async ({ app, newDevice }) => {
    const link = await shareActiveList(app);
    const device = await newDevice();
    await openSharedLink(device, link, "Shopping list");

    // A -> B: add
    await app.addItem("apples");
    await expect(device.itemCard("apples")).toBeVisible();

    // B -> A: add
    await device.addItem("cheese");
    await expect(app.itemCard("cheese")).toBeVisible();

    // B -> A: check off
    await device.checkOff("apples");
    await expect(app.itemCard("apples")).toHaveCount(0);

    // A -> B: edit
    await app.longPress("cheese");
    const dialog = app.page.getByRole("dialog");
    await dialog.getByLabel("Quantity").fill("200 g");
    await dialog.getByRole("button", { name: "Save" }).click();
    await expect(device.itemCard("cheese").locator(".item-quantity")).toHaveText("200 g");

    // A -> B: undo of a check off brings the item back everywhere.
    await device.checkOff("cheese");
    await expect(app.itemCard("cheese")).toHaveCount(0);
    await device.undoToast("cheese").getByRole("button", { name: "Undo" }).click();
    await expect(app.itemCard("cheese")).toBeVisible();
  });

  test("propagates list renames between devices in realtime", async ({ app, newDevice }) => {
    const link = await shareActiveList(app);
    const device = await newDevice();
    await openSharedLink(device, link, "Shopping list");

    await app.renameActiveList("Renamed on A");
    await expect(device.listTitle).toHaveText("Renamed on A");

    await device.renameActiveList("Renamed on B");
    await expect(app.listTitle).toHaveText("Renamed on B");
  });

  test("delivers changes made while a device was looking at another list", async ({ app, newDevice }) => {
    await app.renameActiveList("Shared");
    const link = await shareActiveList(app);
    const device = await newDevice();
    await openSharedLink(device, link, "Shared");

    // B switches to its own list; A keeps editing the shared one.
    await device.selectList("Shopping list");
    await app.addItem("bananas");
    await app.renameActiveList("Shared (edited)");

    // B only learns about the rename once it opens the list again.
    await device.openDrawer();
    await device.drawer.locator(".drawer__item-button", { hasText: "Shared" }).click();
    await expect(device.listTitle).toHaveText("Shared (edited)");
    await expect(device.itemCard("bananas")).toBeVisible();
  });

  test("reconciles offline edits after the connection comes back", async ({ app, newDevice }) => {
    await app.addItem("bread");
    const link = await shareActiveList(app);
    const device = await newDevice();
    await openSharedLink(device, link, "Shopping list");

    await app.disconnectBackend();
    await app.addItem("apples");
    await app.checkOff("bread");
    await app.renameActiveList("Offline rename");

    // Meanwhile B keeps working online.
    await device.addItem("water");

    await app.reconnectBackend();

    await expect(device.itemCard("apples")).toBeVisible();
    await expect(device.itemCard("bread")).toHaveCount(0);
    await expect(device.listTitle).toHaveText("Offline rename");
    await expect(app.itemCard("water")).toBeVisible();
    expect(await app.itemNames()).toEqual(await device.itemNames());
  });

  test("reconciles offline edits after a full app restart", async ({ app, newDevice }) => {
    const link = await shareActiveList(app);
    const device = await newDevice();
    await openSharedLink(device, link, "Shopping list");

    await app.disconnectBackend();
    await app.addItem("apples");
    // Restart while still offline: the edit only lives in IndexedDB now.
    await app.reload();
    await expect(app.itemCard("apples")).toBeVisible();
    await app.reconnectBackend();

    await expect(device.itemCard("apples")).toBeVisible();
  });

  test("a list created while offline is registered once back online", async ({ app, backend }) => {
    await app.waitForRealtimeSync();
    await app.disconnectBackend();
    await app.createList("Made offline");
    await app.addItem("milk");
    await app.reconnectBackend();

    const deviceId = await app.deviceId();
    const listId = await app.activeListId();
    await expect
      .poll(async () => {
        const { body } = await backend.getList(deviceId, listId);
        return body ? [body.name, body.items.map((item) => item.name)] : null;
      }, { timeout: 15_000 })
      .toEqual(["Made offline", ["milk"]]);
  });

  test("hides sharing while offline and shows the offline badge", async ({ app }) => {
    await app.waitForRealtimeSync();
    await expect(app.page.getByRole("button", { name: "Share list" })).toBeVisible();
    await app.disconnectBackend();
    await expect(app.page.getByRole("button", { name: "Share list" })).toBeHidden();

    const badge = app.page.getByRole("button", { name: "Backend status: offline" });
    await badge.click();
    await expect(app.page.getByText(/Backend is currently unreachable/)).toBeVisible();

    await app.reconnectBackend();
    await expect(app.page.getByRole("button", { name: "Share list" })).toBeVisible();
  });

  test.describe("on a touch device", () => {
    test.use({ hasTouch: true });

    test("pull to refresh forces a websocket reconnect", async ({ app }) => {
      await app.waitForRealtimeSync();
      const socketsBefore = app.sockets.length;
      const cdp = await app.page.context().newCDPSession(app.page);
      const touch = (type: "touchStart" | "touchMove" | "touchEnd", y?: number) =>
        cdp.send("Input.dispatchTouchEvent", {
          type,
          touchPoints: y === undefined ? [] : [{ x: 200, y }],
        });
      await touch("touchStart", 150);
      for (let y = 170; y <= 450; y += 20) {
        await touch("touchMove", y);
      }
      await touch("touchEnd");

      await expect(app.page.locator(".pull-refresh-indicator--active")).toBeVisible();
      await expect.poll(() => app.sockets.length).toBeGreaterThan(socketsBefore);
      await app.waitForRealtimeSync();
    });
  });
});
