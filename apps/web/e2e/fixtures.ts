import { existsSync, statSync } from "node:fs";
import { open, writeFile } from "node:fs/promises";
import { test as base, expect, type BrowserContextOptions, type TestInfo } from "@playwright/test";
import { BackendApi } from "./support/backendApi";
import { GoListApp, type InitOptions } from "./support/goListApp";
import { backendLogPath } from "./support/paths";

type DeviceOptions = InitOptions & { contextOptions?: BrowserContextOptions };

type Fixtures = {
  // Auto fixture: attaches the backend log slice of failing tests.
  backendLog: void;
  initOptions: InitOptions;
  // The primary device, already navigated to the app.
  app: GoListApp;
  // Creates an additional, fully isolated device (own browser context).
  newDevice: (options?: DeviceOptions) => Promise<GoListApp>;
  backend: BackendApi;
};

const failed = (testInfo: TestInfo) => testInfo.status !== testInfo.expectedStatus;

const attachText = async (testInfo: TestInfo, fileName: string, content: string) => {
  const path = testInfo.outputPath(fileName);
  await writeFile(path, content);
  await testInfo.attach(fileName, { path, contentType: "text/plain" });
};

// Sync bugs are much easier to diagnose with the raw protocol frames, and
// the browser console shows client-side errors and sync logs.
const attachDeviceLogsOnFailure = async (testInfo: TestInfo, name: string, device: GoListApp) => {
  if (failed(testInfo)) {
    await attachText(testInfo, `${name}-websocket-frames.txt`, device.describeSockets());
    await attachText(testInfo, `${name}-console.txt`, device.consoleMessages.join("\n"));
  }
};

const backendLogSize = () => (existsSync(backendLogPath) ? statSync(backendLogPath).size : 0);

// Attaches the backend log lines written while the test ran. Tests run in
// parallel, so the slice can contain lines from other tests too.
const attachBackendLogOnFailure = async (testInfo: TestInfo, startOffset: number) => {
  if (!failed(testInfo) || !existsSync(backendLogPath)) {
    return;
  }
  const handle = await open(backendLogPath, "r");
  try {
    const length = Math.max(0, backendLogSize() - startOffset);
    const buffer = Buffer.alloc(length);
    await handle.read(buffer, 0, length, startOffset);
    await attachText(testInfo, "backend-log.jsonl", buffer.toString("utf8"));
  } finally {
    await handle.close();
  }
};

export const test = base.extend<Fixtures>({
  initOptions: [{}, { option: true }],

  backendLog: [
    async ({}, use, testInfo) => {
      const startOffset = backendLogSize();
      await use();
      await attachBackendLogOnFailure(testInfo, startOffset);
    },
    { auto: true },
  ],

  app: async ({ page, initOptions }, use, testInfo) => {
    const app = await GoListApp.install(page, initOptions);
    await app.goto();
    await use(app);
    await attachDeviceLogsOnFailure(testInfo, "device-a", app);
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
      await attachDeviceLogsOnFailure(testInfo, `device-${String.fromCharCode(98 + index)}`, device);
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
