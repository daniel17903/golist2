import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Item, List } from "@golist/shared/domain/types";

const listsPut = vi.fn(async (): Promise<void> => undefined);
const itemsBulkPut = vi.fn(async (): Promise<void> => undefined);
// What `db.lists.get` / `db.items.bulkGet` return; tests mirror the
// in-memory lists into `storedLists` and can pre-seed `storedItems`.
let storedLists: List[] = [];
let storedItems: Item[] = [];

vi.mock("../storage/db", () => ({
  db: {
    transaction: async (...args: unknown[]) => {
      const callback = args.at(-1);
      return typeof callback === "function" ? callback() : undefined;
    },
    lists: {
      put: listsPut,
      get: async (id: string) => storedLists.find((list) => list.id === id),
    },
    items: {
      bulkPut: itemsBulkPut,
      bulkGet: async (ids: string[]) => ids.map((id) => storedItems.find((item) => item.id === id)),
    },
  },
}));

vi.mock("./apiClient", () => ({
  sharingApiClient: {
    upsertList: vi.fn(),
  },
}));

afterEach(() => {
  vi.resetModules();
});

const buildDeps = (lists: List[]) => {
  storedLists = lists;
  const applyAcceptedItems = vi.fn();
  const applyListMetadata = vi.fn();
  const deps = {
    getLists: () => lists,
    getItems: (): Item[] => [],
    getDeviceId: () => "device-1",
    applyAcceptedItems,
    applyListMetadata,
    onConnectionState: vi.fn(),
    onError: vi.fn(),
  };
  return { deps, applyAcceptedItems, applyListMetadata };
};

describe("createStoreSyncCallbacks - applyIncomingListMetadata", () => {
  beforeEach(() => {
    listsPut.mockClear();
    itemsBulkPut.mockClear();
  });

  it("applies an incoming rename when its updatedAt is strictly newer", async () => {
    const { createStoreSyncCallbacks } = await import("./storeSyncBridge");
    const list: List = { id: "list-1", name: "Old", createdAt: 1, updatedAt: 100 };
    const { deps, applyListMetadata } = buildDeps([list]);
    const callbacks = createStoreSyncCallbacks(deps);

    await callbacks.applyIncomingListMetadata("list-1", { name: "New", updatedAt: 200 });

    expect(applyListMetadata).toHaveBeenCalledWith(
      expect.objectContaining({ id: "list-1", name: "New", updatedAt: 200 }),
    );
    expect(listsPut).toHaveBeenCalledTimes(1);
  });

  it("ignores an incoming rename when its updatedAt is older", async () => {
    const { createStoreSyncCallbacks } = await import("./storeSyncBridge");
    const list: List = { id: "list-1", name: "Current", createdAt: 1, updatedAt: 200 };
    const { deps, applyListMetadata } = buildDeps([list]);
    const callbacks = createStoreSyncCallbacks(deps);

    await callbacks.applyIncomingListMetadata("list-1", { name: "Stale", updatedAt: 100 });

    expect(applyListMetadata).not.toHaveBeenCalled();
    expect(listsPut).not.toHaveBeenCalled();
  });

  it("does not overwrite a newer name already stored by a concurrent local rename", async () => {
    const { createStoreSyncCallbacks } = await import("./storeSyncBridge");
    const list: List = { id: "list-1", name: "Old", createdAt: 1, updatedAt: 100 };
    const { deps, applyListMetadata } = buildDeps([list]);
    const callbacks = createStoreSyncCallbacks(deps);
    // In memory the list is still "Old"; IndexedDB already has the local rename.
    storedLists = [{ ...list, name: "Local newer", updatedAt: 300 }];

    await callbacks.applyIncomingListMetadata("list-1", { name: "Remote older", updatedAt: 200 });

    expect(listsPut).not.toHaveBeenCalled();
    expect(applyListMetadata).not.toHaveBeenCalled();
  });

  it("ignores a same-timestamp patch carrying the same name (no-op)", async () => {
    const { createStoreSyncCallbacks } = await import("./storeSyncBridge");
    const list: List = { id: "list-1", name: "Same", createdAt: 1, updatedAt: 500 };
    const { deps, applyListMetadata } = buildDeps([list]);
    const callbacks = createStoreSyncCallbacks(deps);

    await callbacks.applyIncomingListMetadata("list-1", { name: "Same", updatedAt: 500 });

    expect(applyListMetadata).not.toHaveBeenCalled();
  });

  // Two devices rename the same shared list to different names while
  // offline, then reconnect near-simultaneously so both patches carry the
  // exact same millisecond `updatedAt`. Without a deterministic tie-break,
  // whichever patch a device happened to receive first would "win" locally,
  // letting the two devices settle on different final names forever. The
  // shared `shouldAcceptListMetadata` rule (lexicographically greater name
  // wins on a tie) must produce the same outcome no matter which side is
  // doing the comparing.
  it("resolves a same-timestamp rename conflict identically regardless of which device is applying it", async () => {
    const { createStoreSyncCallbacks } = await import("./storeSyncBridge");

    // Device A already renamed the list to "Zebra" locally and now receives
    // device B's competing "Alpha" patch (same updatedAt).
    const listOnDeviceA: List = { id: "list-1", name: "Zebra", createdAt: 1, updatedAt: 500 };
    const { deps: depsA, applyListMetadata: applyOnDeviceA } = buildDeps([listOnDeviceA]);
    const callbacksA = createStoreSyncCallbacks(depsA);
    await callbacksA.applyIncomingListMetadata("list-1", { name: "Alpha", updatedAt: 500 });

    // Device B already renamed the list to "Alpha" locally and now receives
    // device A's competing "Zebra" patch (same updatedAt).
    const listOnDeviceB: List = { id: "list-1", name: "Alpha", createdAt: 1, updatedAt: 500 };
    const { deps: depsB, applyListMetadata: applyOnDeviceB } = buildDeps([listOnDeviceB]);
    const callbacksB = createStoreSyncCallbacks(depsB);
    await callbacksB.applyIncomingListMetadata("list-1", { name: "Zebra", updatedAt: 500 });


    // "Zebra" > "Alpha" lexicographically, so it must win everywhere:
    // device A keeps its local "Zebra" (rejects the incoming "Alpha"), and
    // device B adopts "Zebra" from the incoming patch. Both devices converge
    // on the same final name.
    expect(applyOnDeviceA).not.toHaveBeenCalled();
    expect(applyOnDeviceB).toHaveBeenCalledWith(
      expect.objectContaining({ id: "list-1", name: "Zebra", updatedAt: 500 }),
    );
  });
});

describe("createStoreSyncCallbacks - applyIncomingItems", () => {
  beforeEach(() => {
    itemsBulkPut.mockClear();
    storedItems = [];
  });

  // A local edit can be persisted after the in-memory check passed but
  // before the incoming write runs; the stored (newer) version must win.
  it("does not overwrite a newer item already stored by a concurrent local edit", async () => {
    const { createStoreSyncCallbacks } = await import("./storeSyncBridge");
    const list: List = { id: "list-1", name: "List", createdAt: 1, updatedAt: 100 };
    const base: Item = {
      id: "item-1",
      listId: "list-1",
      name: "Milk",
      iconName: "default",
      category: "other",
      deleted: false,
      createdAt: 100,
      updatedAt: 100,
    };
    const { deps, applyAcceptedItems } = buildDeps([list]);
    // In memory the item is still at 100; IndexedDB already has the local edit at 300.
    const callbacks = createStoreSyncCallbacks({ ...deps, getItems: () => [base] });
    storedItems = [{ ...base, name: "Oat milk", updatedAt: 300 }];

    await callbacks.applyIncomingItems("list-1", [{ ...base, name: "Whole milk", updatedAt: 200 }]);

    expect(itemsBulkPut).not.toHaveBeenCalled();
    expect(applyAcceptedItems).not.toHaveBeenCalled();
  });

  it("rejects an item whose listId does not match the patch list", async () => {
    const { createStoreSyncCallbacks } = await import("./storeSyncBridge");
    const list: List = { id: "list-1", name: "List", createdAt: 1, updatedAt: 100 };
    const { deps, applyAcceptedItems } = buildDeps([list]);
    const callbacks = createStoreSyncCallbacks(deps);
    const incoming: Item = {
      id: "item-1",
      listId: "different-list",
      name: "Milk",
      iconName: "default",
      category: "other",
      deleted: false,
      createdAt: 100,
      updatedAt: 100,
    };

    await callbacks.applyIncomingItems("list-1", [incoming]);

    expect(itemsBulkPut).not.toHaveBeenCalled();
    expect(applyAcceptedItems).not.toHaveBeenCalled();
  });

  it("keeps the local createdByDeviceId when the server echo omits it", async () => {
    const { createStoreSyncCallbacks } = await import("./storeSyncBridge");
    const list: List = { id: "list-1", name: "List", createdAt: 1, updatedAt: 100 };
    const local: Item = {
      id: "item-1",
      listId: "list-1",
      name: "Milk",
      iconName: "default",
      category: "other",
      deleted: false,
      createdByDeviceId: "device-1",
      createdAt: 100,
      updatedAt: 100,
    };
    const { deps, applyAcceptedItems } = buildDeps([list]);
    const callbacks = createStoreSyncCallbacks({ ...deps, getItems: () => [local] });
    // Canonical server echo: server-assigned createdAt, no createdByDeviceId.
    const echo: Item = { ...local, createdAt: 150, createdByDeviceId: undefined };

    await callbacks.applyIncomingItems("list-1", [echo]);

    const expected = { ...echo, createdByDeviceId: "device-1" };
    expect(itemsBulkPut).toHaveBeenCalledWith([expected]);
    expect(applyAcceptedItems).toHaveBeenCalledWith([expected]);
  });
});

