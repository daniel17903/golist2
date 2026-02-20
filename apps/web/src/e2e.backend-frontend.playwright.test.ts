import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createServer as createViteServer, type ViteDevServer } from "vite";
import type { QueryResult, QueryResultRow } from "pg";

type SharedList = {
  id: string;
  name: string;
  createdByDeviceId: string;
  createdAt: string;
  updatedAt: string;
};

type SharedListInsertWrite = {
  kind: "insert-shared-list";
  id: string;
  name: string;
  createdByDeviceId: string;
};

const sharedLists = new Map<string, SharedList>();
const dbWrites: SharedListInsertWrite[] = [];

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

const sharedListInsertQuery =
  "INSERT INTO shared_lists(id, name, created_by_device_id, created_at, updated_at) VALUES ($1, $2, $3, NOW(), NOW())";

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

  if (
    text.includes("SELECT id FROM shared_lists WHERE id = $1 FOR UPDATE") ||
    text.includes("SELECT id, created_by_device_id FROM shared_lists WHERE id = $1 FOR UPDATE")
  ) {
    const listId = asString(values[0], "listId");
    const list = sharedLists.get(listId);
    return toResult(
      list
        ? [
            {
              id: list.id,
              created_by_device_id: list.createdByDeviceId,
            },
          ]
        : [],
    );
  }

  if (text.includes(sharedListInsertQuery)) {
    const id = asString(values[0], "id");
    const name = asString(values[1], "name");
    const createdByDeviceId = asString(values[2], "createdByDeviceId");
    const now = new Date().toISOString();

    sharedLists.set(id, { id, name, createdByDeviceId, createdAt: now, updatedAt: now });
    dbWrites.push({ kind: "insert-shared-list", id, name, createdByDeviceId });

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
const frontendPort = 4173;
let backendApp: { close: () => Promise<void> } | null = null;
let viteServer: ViteDevServer | null = null;

const shouldRun = process.env.RUN_PLAYWRIGHT_E2E === "1";
const runE2E = shouldRun ? it : it.skip;

const isUuid = (value: string) =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);

describe("frontend/backend integration via playwright", () => {
  beforeAll(async () => {
    sharedLists.clear();
    dbWrites.length = 0;

    const { buildServer } = await import("../../backend/src/server.js");
    const app = buildServer();
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

  afterAll(async () => {
    await viteServer?.close();
    await backendApp?.close();
  });

  runE2E("creates a list in the UI and syncs it through backend DB writes", async () => {
    const { chromium } = await import("playwright");
    const browser = await chromium.launch();

    try {
      const context = await browser.newContext();
      const page = await context.newPage();

      await page.goto(frontendUrl);

      await expect.poll(() => sharedLists.size).toBeGreaterThanOrEqual(1);
      await expect.poll(() => dbWrites.length).toBeGreaterThanOrEqual(1);

      await page.getByLabel("Open list menu").click();
      await expect.poll(async () => page.locator(".drawer.drawer--open").isVisible()).toBe(true);
      await page.locator(".drawer.drawer--open .drawer__new").evaluate((element) => {
        if (element instanceof HTMLButtonElement) {
          element.click();
        }
      });

      await expect.poll(() => sharedLists.size).toBeGreaterThanOrEqual(2);
      await expect.poll(() => dbWrites.length).toBeGreaterThanOrEqual(2);

      const insertedNames = dbWrites.map((entry) => entry.name);
      expect(insertedNames).toContain("Einkaufsliste");
      expect(insertedNames).toContain("Liste 2");

      for (const write of dbWrites) {
        expect(isUuid(write.id)).toBe(true);
        expect(isUuid(write.createdByDeviceId)).toBe(true);
      }

      const createdList = Array.from(sharedLists.values()).find((list) => list.name === "Liste 2");
      expect(createdList).toBeDefined();
      expect(createdList?.createdByDeviceId).toBeTruthy();
    } finally {
      await browser.close();
    }
  });
});
