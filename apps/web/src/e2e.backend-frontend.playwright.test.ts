import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createServer as createViteServer, type ViteDevServer } from "vite";
import type { QueryResult, QueryResultRow } from "pg";
import type { Browser } from "playwright";

type SharedList = {
  id: string;
  name: string;
  createdByDeviceId: string;
  createdAt: string;
  updatedAt: string;
};

const sharedLists = new Map<string, SharedList>();

const toResult = <T extends QueryResultRow>(rows: T[]): QueryResult<T> => ({
  command: "SELECT",
  rowCount: rows.length,
  oid: 0,
  fields: [],
  rows,
});

const asString = (value: unknown, label: string) => {
  if (typeof value !== "string") {
    throw new Error(`Expected ${label} to be a string`);
  }
  return value;
};

const queryMock = vi.fn(async (text: string, values: unknown[] = []) => {
  if (text === "SELECT 1") {
    return toResult([{ "?column?": 1 }]);
  }

  if (text.includes("AS has_access")) {
    const listId = asString(values[0], "listId");
    const deviceId = asString(values[1], "deviceId");
    const list = sharedLists.get(listId);
    return toResult([{ has_access: list?.createdByDeviceId === deviceId }]);
  }

  if (text.includes("SELECT id FROM shared_lists WHERE id = $1 FOR UPDATE")) {
    const listId = asString(values[0], "listId");
    const list = sharedLists.get(listId);
    return toResult(list ? [{ id: list.id }] : []);
  }

  if (
    text.includes(
      "INSERT INTO shared_lists(id, name, created_by_device_id, created_at, updated_at) VALUES ($1, $2, $3, NOW(), NOW())",
    )
  ) {
    const id = asString(values[0], "id");
    const name = asString(values[1], "name");
    const createdByDeviceId = asString(values[2], "createdByDeviceId");
    const now = new Date().toISOString();
    sharedLists.set(id, { id, name, createdByDeviceId, createdAt: now, updatedAt: now });
    return toResult([]);
  }

  if (text.includes("UPDATE shared_lists SET name = $1, updated_at = NOW() WHERE id = $2")) {
    const name = asString(values[0], "name");
    const id = asString(values[1], "id");
    const current = sharedLists.get(id);
    if (current) {
      sharedLists.set(id, { ...current, name, updatedAt: new Date().toISOString() });
      return toResult([{ id }]);
    }
    return toResult([]);
  }

  if (text.includes("SELECT id, name, created_at, updated_at FROM shared_lists WHERE id = $1 LIMIT 1")) {
    const listId = asString(values[0], "listId");
    const list = sharedLists.get(listId);
    return toResult(
      list
        ? [
            {
              id: list.id,
              name: list.name,
              created_at: list.createdAt,
              updated_at: list.updatedAt,
            },
          ]
        : [],
    );
  }

  if (text.includes("FROM list_items") && text.includes("WHERE list_id = $1")) {
    return toResult([]);
  }

  throw new Error(`Unhandled query in playwright integration test: ${text}`);
});

vi.mock("../../backend/src/db/client.js", () => ({
  query: queryMock,
  withTransaction: async <T>(work: (client: { query: typeof queryMock }) => Promise<T>) =>
    work({ query: queryMock }),
}));

let backendUrl = "";
let frontendUrl = "";
let backendApp: { close: () => Promise<void> } | null = null;
let viteServer: ViteDevServer | null = null;

const shouldRun = process.env.RUN_PLAYWRIGHT_E2E === "1";
const runE2E = shouldRun ? it : it.skip;

describe("frontend/backend integration via playwright", () => {
  beforeAll(async () => {
    sharedLists.clear();

    const { buildServer } = await import("../../backend/src/server.js");
    const app = buildServer();
    await app.listen({ host: "127.0.0.1", port: 0 });
    backendApp = app;

    const backendAddress = app.server.address();
    if (!backendAddress || typeof backendAddress === "string") {
      throw new Error("Failed to resolve backend address");
    }

    backendUrl = `http://127.0.0.1:${backendAddress.port}`;

    process.env.API_BASE_URL = backendUrl;
    process.env.VERCEL = "1";
    process.env.VERCEL_ENV = "preview";

    const currentFile = fileURLToPath(import.meta.url);
    const webRoot = path.resolve(path.dirname(currentFile), "..");

    viteServer = await createViteServer({
      root: webRoot,
      configFile: path.resolve(webRoot, "vite.config.ts"),
      logLevel: "error",
      server: { host: "127.0.0.1", port: 0 },
    });
    await viteServer.listen();

    const frontendAddress = viteServer.httpServer?.address();
    if (!frontendAddress || typeof frontendAddress === "string") {
      throw new Error("Failed to resolve frontend address");
    }

    frontendUrl = `http://127.0.0.1:${frontendAddress.port}`;
  });

  afterAll(async () => {
    await viteServer?.close();
    await backendApp?.close();
  });

  runE2E("creates a list in the UI and syncs it through the backend", async () => {
    const { chromium } = await import("playwright");
    let browser: Browser | null = null;
    try {
      browser = await chromium.launch();
    } catch (error) {
      if (error instanceof Error) {
        const message = error.message.toLowerCase();
        if (
          message.includes("error while loading shared libraries") ||
          message.includes("executable doesn't exist")
        ) {
          console.warn(`Skipping Playwright browser launch in this environment: ${error.message}`);
          return;
        }
      }
      throw error;
    }

    if (!browser) {
      return;
    }

    const context = await browser.newContext();
    const page = await context.newPage();

    await page.goto(frontendUrl);

    await expect.poll(() => sharedLists.size).toBeGreaterThanOrEqual(1);

    await page.getByLabel("Open list menu").click();
    await page.getByRole("button", { name: "Neue Liste erstellen" }).click();

    await expect.poll(async () => page.getByRole("button", { name: "Einkaufsliste 2" }).isVisible()).toBe(true);
    await expect.poll(() => sharedLists.size).toBeGreaterThanOrEqual(2);

    await expect.poll(async () => page.getByText("completed with 201", { exact: false }).isVisible()).toBe(true);

    await browser.close();
  });
});
