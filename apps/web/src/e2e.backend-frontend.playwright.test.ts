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

type DbWrite =
  | {
      kind: "insert-shared-list";
      id: string;
      name: string;
      createdByDeviceId: string;
    }
  | {
      kind: "insert-list-item";
      id: string;
      listId: string;
      name: string;
      createdByDeviceId: string;
    }
  | {
      kind: "insert-share-token";
      tokenId: string;
      listId: string;
      createdByDeviceId: string;
    };

type StoredItem = {
  id: string;
  listId: string;
  name: string;
  quantityOrUnit?: string;
  category: string;
  deleted: boolean;
  createdAt: string;
  updatedAt: string;
};

const sharedLists = new Map<string, SharedList>();
const listItems = new Map<string, StoredItem>();
const dbWrites: DbWrite[] = [];

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

const asBoolean = (value: unknown, label: string) => {
  if (typeof value !== "boolean") {
    throw new Error(`Expected ${label} to be a boolean`);
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

  if (text.includes("UPDATE shared_lists SET updated_at = GREATEST(updated_at, $2::timestamptz) WHERE id = $1")) {
    const listId = asString(values[0], "listId");
    const updatedAt = asString(values[1], "updatedAt");
    const current = sharedLists.get(listId);
    if (current) {
      sharedLists.set(listId, { ...current, updatedAt });
      return toResult([{ id: listId }]);
    }
    return toResult([]);
  }

  if (text.includes("SELECT id, list_id FROM list_items WHERE id = $1 FOR UPDATE")) {
    const itemId = asString(values[0], "itemId");
    const item = listItems.get(itemId);
    return toResult(item ? [{ id: item.id, list_id: item.listId }] : []);
  }

  if (text.includes("INSERT INTO list_items(id, list_id, name, quantity_or_unit, category, deleted, created_by_device_id")) {
    const id = asString(values[0], "itemId");
    const listId = asString(values[1], "listId");
    const name = asString(values[2], "itemName");
    const quantityOrUnitRaw = values[3];
    const quantityOrUnit = typeof quantityOrUnitRaw === "string" ? quantityOrUnitRaw : undefined;
    const category = asString(values[4], "category");
    const deleted = asBoolean(values[5], "deleted");
    const createdByDeviceId = asString(values[6], "createdByDeviceId");
    const updatedAt = asString(values[7], "updatedAt");

    listItems.set(id, {
      id,
      listId,
      name,
      quantityOrUnit,
      category,
      deleted,
      createdAt: updatedAt,
      updatedAt,
    });
    dbWrites.push({ kind: "insert-list-item", id, listId, name, createdByDeviceId });
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
    const listId = asString(values[0], "listId");
    const itemsForList = Array.from(listItems.values())
      .filter((entry) => entry.listId === listId)
      .map((item) => ({
        id: item.id,
        name: item.name,
        quantity_or_unit: item.quantityOrUnit ?? null,
        category: item.category,
        deleted: item.deleted,
        created_at: item.createdAt,
        updated_at: item.updatedAt,
      }));
    return toResult(itemsForList);
  }

  if (text.includes("INSERT INTO share_tokens(id, list_id, created_by_device_id, created_at)")) {
    const tokenId = asString(values[0], "tokenId");
    const listId = asString(values[1], "listId");
    const createdByDeviceId = asString(values[2], "createdByDeviceId");
    const createdAt = new Date().toISOString();

    dbWrites.push({ kind: "insert-share-token", tokenId, listId, createdByDeviceId });
    return toResult([{ created_at: createdAt }]);
  }

  if (text.includes("INSERT INTO share_token_redemptions(token_id, device_id, redeemed_at)")) {
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
    listItems.clear();
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
      const context = await browser.newContext({ permissions: ["clipboard-write"] });
      const page = await context.newPage();

      page.on("dialog", async (dialog) => {
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

      await expect.poll(() => sharedLists.size).toBeGreaterThanOrEqual(1);
      await expect.poll(() => dbWrites.filter((entry) => entry.kind === "insert-shared-list").length).toBe(1);

      await page.getByLabel("Open list menu").click();
      await expect.poll(async () => page.locator(".drawer.drawer--open").isVisible()).toBe(true);
      await page.locator(".drawer.drawer--open .drawer__new").evaluate((element) => {
        if (element instanceof HTMLButtonElement) {
          element.click();
        }
      });

      await expect.poll(() => dbWrites.filter((entry) => entry.kind === "insert-shared-list").length).toBe(2);

      await page.getByLabel("Add item").click();
      await page.getByLabel("Item name").fill("Milch 1L");
      await page.getByLabel("Item name").press("Enter");

      await expect.poll(() => dbWrites.filter((entry) => entry.kind === "insert-list-item").length).toBe(1);

      const secondListWrite = dbWrites
        .filter((entry): entry is Extract<DbWrite, { kind: "insert-shared-list" }> => entry.kind === "insert-shared-list")
        .find((entry) => entry.name === "Liste 2");
      expect(secondListWrite).toBeDefined();

      await page.evaluate(async ({ listId, deviceId }) => {
        await fetch(`/v1/lists/${listId}/share-tokens`, {
          method: "POST",
          headers: {
            "x-device-id": deviceId,
          },
        });
      }, { listId: secondListWrite?.id ?? "", deviceId: secondListWrite?.createdByDeviceId ?? "" });

      await expect.poll(() => dbWrites.filter((entry) => entry.kind === "insert-share-token").length).toBe(1);

      const listWrites = dbWrites.filter((entry) => entry.kind === "insert-shared-list");
      expect(listWrites.map((entry) => entry.name)).toEqual(expect.arrayContaining(["Einkaufsliste", "Liste 2"]));
      for (const write of listWrites) {
        expect(isUuid(write.id)).toBe(true);
        expect(isUuid(write.createdByDeviceId)).toBe(true);
      }

      const itemWrites = dbWrites.filter((entry) => entry.kind === "insert-list-item");
      expect(itemWrites[0]?.name).toBe("Milch");
      expect(itemWrites[0] ? isUuid(itemWrites[0].id) : false).toBe(true);
      expect(itemWrites[0] ? isUuid(itemWrites[0].createdByDeviceId) : false).toBe(true);

      const tokenWrites = dbWrites.filter((entry) => entry.kind === "insert-share-token");
      expect(tokenWrites[0] ? isUuid(tokenWrites[0].tokenId) : false).toBe(true);
      expect(tokenWrites[0] ? isUuid(tokenWrites[0].listId) : false).toBe(true);
      expect(tokenWrites[0] ? isUuid(tokenWrites[0].createdByDeviceId) : false).toBe(true);
    } finally {
      await browser.close();
    }
  });
});
