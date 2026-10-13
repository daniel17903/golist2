import { expect, test } from "./fixtures";
import { expectDevicesConverged, shareAcross } from "./support/multiDevice";

// Multi-device conflict scenarios in real browsers. The fast in-process
// equivalents (and many more cases) live in sim/scenarios; these confirm the
// same behaviour end to end through the UI, IndexedDB and the real backend.
test.describe("multi-device conflicts", () => {
  test("concurrent offline edits of the same item converge on the later edit", async ({ app, newDevice, backend }) => {
    await app.addItem("cheese");
    const [, device] = await shareAcross(app, newDevice, 1);
    await expect(device.itemCard("cheese")).toBeVisible();

    await app.disconnectBackend();
    await device.disconnectBackend();
    await app.editItem("cheese", { name: "gouda" });
    await device.editItem("cheese", { name: "cheddar" }); // later

    // The device holding the older edit reconnects last and must not win.
    await device.reconnectBackend();
    await app.reconnectBackend();

    await expectDevicesConverged([app, device], backend);
    expect(await app.itemNames()).toEqual(["cheddar"]);
  });

  test("an offline check-off and a later edit on another device converge", async ({ app, newDevice, backend }) => {
    await app.addItem("yoghurt");
    const [, device] = await shareAcross(app, newDevice, 1);
    await expect(device.itemCard("yoghurt")).toBeVisible();

    await app.disconnectBackend();
    await app.checkOff("yoghurt");
    await device.editItem("yoghurt", { quantity: "500g" }); // newer: item stays visible
    await app.reconnectBackend();

    await expectDevicesConverged([app, device], backend);
    await expect(app.itemCard("yoghurt").locator(".item-quantity")).toHaveText("500g");
  });

  test("both devices adding items offline end up with all items", async ({ app, newDevice, backend }) => {
    const [, device] = await shareAcross(app, newDevice, 1);

    await app.disconnectBackend();
    await device.disconnectBackend();
    await app.addItem("apples");
    await app.addItem("bread");
    await device.addItem("coffee");
    await app.reconnectBackend();
    await device.reconnectBackend();

    await expectDevicesConverged([app, device], backend);
    expect((await device.itemNames()).sort()).toEqual(["apples", "bread", "coffee"]);
  });

  test("three devices stay in sync", async ({ app, newDevice, backend }) => {
    const [, second, third] = await shareAcross(app, newDevice, 2);

    await app.addItem("apples");
    await second.addItem("pears");
    await third.addItem("plums");
    await expectDevicesConverged([app, second, third], backend);

    await third.checkOff("apples");
    await second.renameActiveList("Fruit");
    await expectDevicesConverged([app, second, third], backend);
    expect((await app.itemNames()).sort()).toEqual(["pears", "plums"]);
    await expect(app.listTitle).toHaveText("Fruit");
  });

  test("converges over a slow connection", async ({ app, newDevice, backend }) => {
    const [, device] = await shareAcross(app, newDevice, 1);
    device.setBackendLatency(400);

    await app.addItem("tea");
    await device.addItem("coffee");
    await app.addItem("sugar");
    await device.checkOff("tea");

    await expectDevicesConverged([app, device], backend);
    expect((await app.itemNames()).sort()).toEqual(["coffee", "sugar"]);
  });
});
