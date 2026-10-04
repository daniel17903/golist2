import { writeFile } from "node:fs/promises";
import { test as base, expect, type BrowserContextOptions, type TestInfo } from "@playwright/test";
import { BackendApi } from "./support/backendApi";
import { GoListApp, type InitOptions } from "./support/goListApp";

type DeviceOptions = InitOptions & { contextOptions?: BrowserContextOptions };

type Fixtures = {
  initOptions: InitOptions;
  // The primary device, already navigated to the app.
  app: GoListApp;
  // Creates an additional, fully isolated device (own browser context).
  newDevice: (options?: DeviceOptions) => Promise<GoListApp>;
  backend: BackendApi;
};

// Sync bugs are much easier to diagnose with the raw protocol frames.
const attachSocketLogOnFailure = async (testInfo: TestInfo, name: string, device: GoListApp) => {
  if (testInfo.status !== testInfo.expectedStatus) {
    const path = testInfo.outputPath(`${name}-websocket-frames.txt`);
    await writeFile(path, device.describeSockets());
    await testInfo.attach(`${name}-websocket-frames.txt`, { path, contentType: "text/plain" });
  }
};

export const test = base.extend<Fixtures>({
  initOptions: [{}, { option: true }],

  app: async ({ page, initOptions }, use, testInfo) => {
    const app = await GoListApp.install(page, initOptions);
    await app.goto();
    await use(app);
    await attachSocketLogOnFailure(testInfo, "device-a", app);
    expect(app.pageErrors, "uncaught page errors").toEqual([]);
  },

  newDevice: async ({ browser, contextOptions }, use, testInfo) => {
    const devices: GoListApp[] = [];
    const contexts: Awaited<ReturnType<typeof browser.newContext>>[] = [];
    await use(async (options: DeviceOptions = {}) => {
      const context = await browser.newContext({ ...contextOptions, ...options.contextOptions });
      contexts.push(context);
      const device = await GoListApp.install(await context.newPage(), options);
      devices.push(device);
      return device;
    });
    for (const [index, device] of devices.entries()) {
      await attachSocketLogOnFailure(testInfo, `device-${String.fromCharCode(98 + index)}`, device);
    }
    for (const context of contexts) {
      await context.close();
    }
    for (const device of devices) {
      expect(device.pageErrors, "uncaught page errors on secondary device").toEqual([]);
    }
  },

  backend: async ({}, use) => {
    const api = await BackendApi.create();
    await use(api);
    await api.dispose();
  },
});

export { expect };
