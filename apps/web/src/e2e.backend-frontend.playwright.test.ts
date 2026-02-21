import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { Browser, BrowserContext, Page } from "playwright";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createServer as createViteServer, type ViteDevServer } from "vite";

import { InMemoryListRepository } from "../../backend/src/test/in-memory-list-repository.js";

type RepositoryState = {
  lists: Map<string, { data: { id: string; name: string }; createdByDeviceId: string }>;
  items: Map<string, { id: string; listId: string; name: string }>;
  shareTokens: Map<string, { id: string; listId: string; createdByDeviceId: string }>;
};

const repository = new InMemoryListRepository();

const readRepositoryState = () => repository as unknown as RepositoryState;

let backendUrl = "";
let frontendUrl = "";
const frontendPort = 4173;
let backendApp: { close: () => Promise<void> } | null = null;
let viteServer: ViteDevServer | null = null;
let browser: Browser | null = null;
let context: BrowserContext | null = null;
let page: Page | null = null;

const shouldRun = process.env.RUN_PLAYWRIGHT_E2E === "1";
const runE2E = shouldRun ? it : it.skip;

const isUuid = (value: string) =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);

describe("frontend/backend integration via playwright", () => {
  beforeAll(async () => {
    const { buildServer } = await import("../../backend/src/server.js");
    const app = buildServer({ listRepository: repository });
    await app.listen({ host: "127.0.0.1", port: 0 });
    backendApp = app;

    const backendAddress = app.server.address();
    if (!backendAddress || typeof backendAddress === "string") {
      throw new Error("Failed to resolve backend address");
    }

    backendUrl = `http://127.0.0.1:${backendAddress.port}`;

    process.env.API_BASE_URL = `http://127.0.0.1:${frontendPort}`;
    process.env.VERCEL = "1";
    process.env.VERCEL_ENV = "preview";

    const currentFile = fileURLToPath(import.meta.url);
    const webRoot = path.resolve(path.dirname(currentFile), "..");

    viteServer = await createViteServer({
      root: webRoot,
      configFile: path.resolve(webRoot, "vite.config.ts"),
      logLevel: "error",
      define: {
        __API_BASE_URL__: JSON.stringify(`http://127.0.0.1:${frontendPort}`),
      },
      server: {
        host: "127.0.0.1",
        port: frontendPort,
        strictPort: true,
        proxy: {
          "/v1": backendUrl,
          "/health": backendUrl,
        },
      },
    });
    await viteServer.listen();

    const frontendAddress = viteServer.httpServer?.address();
    if (!frontendAddress || typeof frontendAddress === "string") {
      throw new Error("Failed to resolve frontend address");
    }

    frontendUrl = `http://127.0.0.1:${frontendAddress.port}`;
  });

  beforeEach(async () => {
    const state = readRepositoryState();
    state.lists.clear();
    state.items.clear();
    state.shareTokens.clear();

    const { chromium } = await import("playwright");
    const launchedBrowser = await chromium.launch();
    browser = launchedBrowser;
    const launchedContext = await launchedBrowser.newContext({ permissions: ["clipboard-write"] });
    context = launchedContext;
    page = await launchedContext.newPage();

    page.on("dialog", async (dialog: { accept: () => Promise<void> }) => {
      await dialog.accept();
    });

    await page.addInitScript(() => {
      Object.defineProperty(window.navigator, "clipboard", {
        configurable: true,
        value: {
          writeText: async () => undefined,
        },
      });
    });

    await page.goto(frontendUrl);
    await expect.poll(() => readRepositoryState().lists.size).toBe(1);
  });

  afterEach(async () => {
    await context?.close();
    await browser?.close();
    context = null;
    browser = null;
    page = null;
  });

  afterAll(async () => {
    await viteServer?.close();
    await backendApp?.close();
  });

  runE2E("creates the default list in the in-memory repository", async () => {
    const [defaultList] = [...readRepositoryState().lists.values()];
    expect(defaultList?.data.name).toBe("Einkaufsliste");
    expect(defaultList ? isUuid(defaultList.data.id) : false).toBe(true);
    expect(defaultList ? isUuid(defaultList.createdByDeviceId) : false).toBe(true);
  });

  runE2E("creates an additional list from the list drawer", async () => {
    await page!.getByLabel("Open list menu").click();
    await expect.poll(async () => page!.locator(".drawer.drawer--open").isVisible()).toBe(true);
    await page!.locator(".drawer.drawer--open .drawer__new").evaluate((element: Element) => {
      if (element instanceof HTMLButtonElement) {
        element.click();
      }
    });

    await expect.poll(() => readRepositoryState().lists.size).toBe(2);
    const names = [...readRepositoryState().lists.values()].map((entry) => entry.data.name);
    expect(names).toEqual(expect.arrayContaining(["Einkaufsliste", "Liste 2"]));
  });

  runE2E("upserts a list item from the add item flow", async () => {
    await page!.getByLabel("Add item").click();
    await page!.getByLabel("Item name").fill("Milch 1L");
    await page!.getByLabel("Item name").press("Enter");

    await expect.poll(() => readRepositoryState().items.size).toBe(1);
    const [createdItem] = [...readRepositoryState().items.values()];
    expect(createdItem?.name).toBe("Milch");
    expect(createdItem ? isUuid(createdItem.id) : false).toBe(true);
    expect(createdItem ? isUuid(createdItem.listId) : false).toBe(true);
  });

  runE2E("creates a share token for a list", async () => {
    const [defaultList] = [...readRepositoryState().lists.values()];
    expect(defaultList).toBeDefined();

    await page!.evaluate(async ({ listId, deviceId }: { listId: string; deviceId: string }) => {
      await fetch(`/v1/lists/${listId}/share-tokens`, {
        method: "POST",
        headers: {
          "x-device-id": deviceId,
        },
      });
    }, { listId: defaultList?.data.id ?? "", deviceId: defaultList?.createdByDeviceId ?? "" });

    await expect.poll(() => readRepositoryState().shareTokens.size).toBe(1);
    const [shareToken] = [...readRepositoryState().shareTokens.values()];
    expect(shareToken ? isUuid(shareToken.id) : false).toBe(true);
    expect(shareToken?.listId).toBe(defaultList?.data.id);
    expect(shareToken?.createdByDeviceId).toBe(defaultList?.createdByDeviceId);
  });
});
