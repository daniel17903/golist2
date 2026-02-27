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

const readRepositoryState = (): RepositoryState => {
  const lists = Reflect.get(repository, "lists");
  const items = Reflect.get(repository, "items");
  const shareTokens = Reflect.get(repository, "shareTokens");

  if (!(lists instanceof Map) || !(items instanceof Map) || !(shareTokens instanceof Map)) {
    throw new Error("Unexpected in-memory repository state shape");
  }

  return { lists, items, shareTokens };
};

let backendUrl = "";
let frontendUrl = "";
const frontendPort = 4173;
let backendApp: { close: () => Promise<void> } | null = null;
let viteServer: ViteDevServer | null = null;
let browser: Browser | null = null;
let context: BrowserContext | null = null;
let page: Page | null = null;
let observedRequests: { method: string; url: string }[] = [];
let observedWebSockets: Array<{
  url: string;
  sent: string[];
  received: string[];
  closed: boolean;
}> = [];

const shouldRun = process.env.RUN_PLAYWRIGHT_E2E === "1";
const runE2E = shouldRun ? it : it.skip;

const isUuid = (value: string) =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);

const expectListPutBeforeFirstGet = (listId: string) => {
  const listRequests = observedRequests.filter((request) => request.url.includes(`/v1/lists/${listId}`));
  const firstPutIndex = listRequests.findIndex((request) => request.method === "PUT");
  const firstGetIndex = listRequests.findIndex((request) => request.method === "GET");

  expect(firstPutIndex).toBeGreaterThanOrEqual(0);
  expect(firstGetIndex).toBeGreaterThanOrEqual(0);
  expect(firstPutIndex).toBeLessThan(firstGetIndex);
};

const expectFrontendConnectedToBackend = async () => {
  await expect.poll(() =>
    observedWebSockets.some((socket) =>
      socket.url.includes("/v1/ws") &&
      socket.sent.some((frame) => frame.includes('"type":"hello"')) &&
      socket.sent.some((frame) => frame.includes('"type":"subscribe_list"')) &&
      socket.received.some((frame) => frame.includes('"type":"hello_ack"')) &&
      socket.received.some((frame) => frame.includes('"type":"subscribed"')),
    ),
    { timeout: 15_000 },
  ).toBe(true);
};


const waitForShareButton = async () => {
  for (let attempt = 0; attempt < 4; attempt += 1) {
    await expectFrontendConnectedToBackend();

    const shareButton = page!.getByLabel("Share list");
    if (await shareButton.isVisible()) {
      return shareButton;
    }

    if (attempt < 3) {
      await page!.reload({ waitUntil: "networkidle" });
    }
  }

  throw new Error("Share button did not become visible after backend connection retries");
};

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

    process.env.API_BASE_URL = backendUrl;
    process.env.ENVIRONMENT = "preview";

    const currentFile = fileURLToPath(import.meta.url);
    const webRoot = path.resolve(path.dirname(currentFile), "..");

    viteServer = await createViteServer({
      root: webRoot,
      configFile: path.resolve(webRoot, "vite.config.ts"),
      logLevel: "error",
      define: {
        __API_BASE_URL__: JSON.stringify(backendUrl),
      },
      server: {
        host: "127.0.0.1",
        port: frontendPort,
        strictPort: true,
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
    const launchedContext = await launchedBrowser.newContext({
      permissions: ["clipboard-write"],
      locale: "en-US",
      viewport: { width: 390, height: 844 },
    });
    context = launchedContext;
    page = await launchedContext.newPage();
    observedRequests = [];
    observedWebSockets = [];

    page.on("request", (request) => {
      observedRequests.push({ method: request.method(), url: request.url() });
    });

    page.on("websocket", (websocket) => {
      const observedSocket: {
        url: string;
        sent: string[];
        received: string[];
        closed: boolean;
      } = {
        url: websocket.url(),
        sent: [],
        received: [],
        closed: false,
      };
      observedWebSockets.push(observedSocket);

      websocket.on("framesent", (frame) => {
        observedSocket.sent.push(typeof frame.payload === "string" ? frame.payload : frame.payload.toString("utf8"));
      });
      websocket.on("framereceived", (frame) => {
        observedSocket.received.push(typeof frame.payload === "string" ? frame.payload : frame.payload.toString("utf8"));
      });
      websocket.on("close", () => {
        observedSocket.closed = true;
      });
    });

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
    expect(defaultList?.data.name).toBe("Shopping list");
    expect(defaultList ? isUuid(defaultList.data.id) : false).toBe(true);
    expect(defaultList ? isUuid(defaultList.createdByDeviceId) : false).toBe(true);

    await expect.poll(() =>
      observedRequests.some(
        (request) => request.method === "GET" && request.url.includes(`/v1/lists/${defaultList!.data.id}`),
      ),
    ).toBe(true);

    expectListPutBeforeFirstGet(defaultList!.data.id);

    await expect.poll(() =>
      observedWebSockets.some((socket) =>
        socket.url.includes("/v1/ws") &&
        socket.sent.some((frame) => frame.includes('"type":"hello"')) &&
        socket.sent.some((frame) => frame.includes('"type":"subscribe_list"')) &&
        socket.received.some((frame) => frame.includes('"type":"hello_ack"')) &&
        socket.received.some((frame) => frame.includes('"type":"subscribed"')),
      ),
    ).toBe(true);
  });

  runE2E("creates an additional list from the list drawer", async () => {
    await page!.getByLabel("Open list menu").click();
    await expect.poll(async () => page!.locator(".drawer.drawer--open").isVisible()).toBe(true);
    await page!.locator(".drawer.drawer--open .drawer__new").evaluate((element: Element) => {
      if (element instanceof HTMLButtonElement) {
        element.click();
      }
    });

    await expect.poll(async () => page!.getByRole("heading", { name: "Create new list" }).isVisible()).toBe(true);
    await page!.getByRole("textbox", { name: "Name" }).fill("Wochenmarkt");
    await page!.getByRole("button", { name: "Create" }).click();

    await expect.poll(() => readRepositoryState().lists.size).toBe(2);
    const lists = [...readRepositoryState().lists.values()];
    const names = lists.map((entry) => entry.data.name);
    expect(names).toEqual(expect.arrayContaining(["Shopping list", "Wochenmarkt"]));

    const newList = lists.find((entry) => entry.data.name === "Wochenmarkt");
    expect(newList).toBeDefined();

    await expect.poll(() =>
      observedRequests.some(
        (request) => request.method === "GET" && request.url.includes(`/v1/lists/${newList!.data.id}`),
      ),
    ).toBe(true);

    expectListPutBeforeFirstGet(newList!.data.id);
  });

  runE2E("upserts a list item from the add item flow", async () => {
    await page!.getByLabel("Add item").click();
    await page!.getByLabel("Item name").fill("milk 1L");
    await page!.getByLabel("Item name").press("Enter");

    await expect.poll(() => readRepositoryState().items.size).toBe(1);
    const [createdItem] = [...readRepositoryState().items.values()];
    expect(createdItem?.name).toBe("milk");
    expect(createdItem ? isUuid(createdItem.id) : false).toBe(true);
    expect(createdItem ? isUuid(createdItem.listId) : false).toBe(true);
  });

  runE2E("clicking share calls the endpoint and creates a share token", async () => {
    const shareButton = await waitForShareButton();

    const shareTokenRequestPromise = page!.waitForRequest(
      (request) => request.method() === "POST" && request.url().includes("/share-tokens"),
      { timeout: 10_000 },
    );

    await shareButton.click();

    const shareTokenRequest = await shareTokenRequestPromise;
    expect(shareTokenRequest.method()).toBe("POST");
    expect(shareTokenRequest.url()).toContain("/share-tokens");

    const matchedListId = /\/v1\/lists\/([^/]+)\/share-tokens/.exec(shareTokenRequest.url())?.[1];
    expect(matchedListId).toBeDefined();

    await expect.poll(() => readRepositoryState().shareTokens.size).toBe(1);
    const [shareToken] = [...readRepositoryState().shareTokens.values()];
    expect(shareToken ? isUuid(shareToken.id) : false).toBe(true);
    expect(shareToken?.listId).toBe(matchedListId);
    expect(shareToken?.createdByDeviceId).toBeTypeOf("string");
  }, 30_000);
});
