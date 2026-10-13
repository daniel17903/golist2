import { expect } from "@playwright/test";
import type { BackendApi } from "./backendApi";
import type { GoListApp, InitOptions } from "./goListApp";

const shareTokenPattern = /\?shareToken=([0-9a-f-]{36})$/;

// Shares the device's active list; returns the copied share link.
export const shareActiveList = async (app: GoListApp) => {
  await app.waitForRealtimeSync();
  await app.page.getByRole("button", { name: "Share list" }).click();
  await expect(app.page.getByText("Share link copied to clipboard.")).toBeVisible();
  const link = (await app.copiedTexts()).at(-1);
  expect(link).toMatch(shareTokenPattern);
  return link!;
};

export const shareTokenOf = (link: string) => shareTokenPattern.exec(link)![1];

// Opens a share link on a fresh device and waits until it shows the list.
export const openSharedLink = async (device: GoListApp, link: string, listName: string) => {
  await device.page.goto(new URL(link).search ? `/${new URL(link).search}` : link);
  await expect(device.listTitle).toHaveText(listName);
  await device.waitForRealtimeSync();
};

/**
 * `app` shares its active list with `extraDevices` new devices.
 * Returns all devices (app first), each showing the shared list and
 * subscribed for realtime sync.
 */
export const shareAcross = async (
  app: GoListApp,
  newDevice: (options?: InitOptions) => Promise<GoListApp>,
  extraDevices: number,
) => {
  const listName = (await app.listTitle.textContent()) ?? "";
  const link = await shareActiveList(app);
  const devices = [app];
  for (let index = 0; index < extraDevices; index += 1) {
    const device = await newDevice();
    await openSharedLink(device, link, listName);
    devices.push(device);
  }
  return devices;
};

const visibleState = async (device: GoListApp) => ({
  title: await device.listTitle.textContent(),
  items: (await device.itemNames()).sort(),
});

/**
 * Waits until every device shows the same list title and the same visible
 * items — and, when `backend` is given, until those match what the server
 * stored (non-deleted items).
 */
export const expectDevicesConverged = async (devices: GoListApp[], backend?: BackendApi, timeout = 15_000) => {
  await expect
    .poll(
      async () => {
        const states = await Promise.all(devices.map(visibleState));
        const reference = JSON.stringify(states[0]);
        if (!states.every((state) => JSON.stringify(state) === reference)) {
          return { converged: false, states };
        }
        if (backend) {
          const remote = (await backend.getList(await devices[0].deviceId(), await devices[0].activeListId())).body;
          const server = {
            title: remote?.name ?? null,
            items: (remote?.items ?? []).filter((item) => !item.deleted).map((item) => item.name).sort(),
          };
          if (JSON.stringify(server) !== reference) {
            return { converged: false, states, server };
          }
        }
        return { converged: true };
      },
      { timeout, message: "devices (and backend) did not converge on the same list state" },
    )
    .toEqual({ converged: true });
};
