import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Item, List } from "@golist/shared/domain/types";

vi.stubGlobal("__APP_VERSION__", "test-version");


const createMemoryStorage = () => {
  const data = new Map<string, string>();
  return {
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => {
      data.set(key, value);
    },
    removeItem: (key: string) => {
      data.delete(key);
    },
    clear: () => {
      data.clear();
    },
  };
};

vi.stubGlobal("localStorage", createMemoryStorage());


vi.mock("../sharing/apiClient", () => ({
  extractShareToken: (value: string) => value,
  sharingApiClient: {
    upsertList: vi.fn(),
    fetchList: vi.fn(),
    redeemShareToken: vi.fn(),
    createShareToken: vi.fn(),
    upsertItem: vi.fn(),
  },
  setBackendCallLogger: vi.fn(),
}));

let listsData: List[] = [];
let itemsData: Item[] = [];
let listSharesData: Array<{ listId: string; shareToken: string; lastSyncedAt: number }> = [];
const metadataPut = vi.fn();
const listAdd = vi.fn(async (list: List) => {
  listsData.push(list);
  return list.id;
});
const listUpdate = vi.fn(async (id: string, updates: Partial<List>) => {
  listsData = listsData.map((list) => (list.id === id ? { ...list, ...updates } : list));
});
const listDelete = vi.fn(async (id: string) => {
  listsData = listsData.filter((list) => list.id !== id);
});
const itemAdd = vi.fn(async (item: Item) => {
  itemsData.push(item);
  return item.id;
});
const itemPut = vi.fn(async (item: Item) => {
  const index = itemsData.findIndex((entry) => entry.id === item.id);
  if (index >= 0) {
    itemsData[index] = item;
    return;
  }
  itemsData.push(item);
});
const itemBulkPut = vi.fn(async (items: Item[]) => {
  for (const item of items) {
    const index = itemsData.findIndex((entry) => entry.id === item.id);
    if (index >= 0) {
      itemsData[index] = item;
    } else {
      itemsData.push(item);
    }
  }
});
const itemsWhere = vi.fn((field: keyof Item) => ({
  equals: (value: Item[keyof Item]) => ({
    delete: vi.fn(async () => {
      if (field === "listId") {
        itemsData = itemsData.filter((item) => item.listId !== value);
      }
    }),
  }),
}));

vi.mock("../storage/db", () => ({
  db: {
    lists: {
      toArray: vi.fn(async () => [...listsData]),
      add: listAdd,
      update: listUpdate,
      delete: listDelete,
    },
    items: {
      toArray: vi.fn(async () => [...itemsData]),
      add: itemAdd,
      put: itemPut,
      bulkPut: itemBulkPut,
      where: itemsWhere,
    },
    metadata: {
      put: metadataPut,
    },
    listShares: {
      toArray: vi.fn(async () => [...listSharesData]),
      put: vi.fn(async (entry: { listId: string; shareToken: string; lastSyncedAt: number }) => {
        const index = listSharesData.findIndex((item) => item.listId === entry.listId);
        if (index >= 0) {
          listSharesData[index] = entry;
        } else {
          listSharesData.push(entry);
        }
      }),
      delete: vi.fn(async (listId: string) => {
        listSharesData = listSharesData.filter((entry) => entry.listId !== listId);
      }),
    },
  },
}));

const { useStore } = await import("./useStore");
const { sharingApiClient } = await import("../sharing/apiClient");

const upsertListMock = vi.mocked(sharingApiClient.upsertList);
const createShareTokenMock = vi.mocked(sharingApiClient.createShareToken);
const fetchListMock = vi.mocked(sharingApiClient.fetchList);
const upsertItemMock = vi.mocked(sharingApiClient.upsertItem);

const resetStore = () => {
  useStore.setState({
    lists: [],
    items: [],
    isLoaded: false,
    activeListId: undefined,
    metadata: undefined,
    listShareTokens: {},
    backendConnection: "unknown",
    syncNotice: undefined,
    backendLogs: [],
  });
};

describe("useStore", () => {
  beforeEach(() => {
    listsData = [];
    itemsData = [];
    listSharesData = [];
    metadataPut.mockClear();
    listAdd.mockClear();
    listUpdate.mockClear();
    listDelete.mockClear();
    itemAdd.mockClear();
    itemPut.mockClear();
    itemBulkPut.mockClear();
    itemsWhere.mockClear();
    upsertListMock.mockReset();
    createShareTokenMock.mockReset();
    fetchListMock.mockReset();
    upsertItemMock.mockReset();
    globalThis.localStorage.clear();
    resetStore();
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2024-01-01T00:00:00Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("loads lists and items, sorting lists by creation time", async () => {
    listsData = [
      { id: "b", name: "Later", createdAt: 2, updatedAt: 2 },
      { id: "a", name: "Earlier", createdAt: 1, updatedAt: 1 },
    ];
    itemsData = [
      {
        id: "item-1",
        listId: "a",
        name: "apple",
        category: "fruitsVegetables",
        deleted: false,
        createdAt: 10,
        updatedAt: 10,
      },
    ];

    await useStore.getState().load();
    const state = useStore.getState();

    expect(state.lists.map((list) => list.id)).toEqual(["a", "b"]);
    expect(state.items).toHaveLength(1);
    expect(state.activeListId).toBe("a");
    expect(state.metadata?.appVersion).toBe("test-version");
    expect(state.metadata?.deviceId).toBeTypeOf("string");
    expect(state.isLoaded).toBe(true);
    expect(metadataPut).toHaveBeenCalledTimes(1);
  });

  it("adds a list and sets it active", async () => {
    const uuidSpy = vi
      .spyOn(globalThis.crypto, "randomUUID")
      .mockReturnValue("00000000-0000-0000-0000-000000000001");

    await useStore.getState().load();

    await useStore.getState().addList("Groceries");

    const state = useStore.getState();
    expect(state.lists).toHaveLength(1);
    expect(state.lists[0]?.id).toBe("00000000-0000-0000-0000-000000000001");
    expect(state.lists[0]?.name).toBe("Groceries");
    expect(typeof state.lists[0]?.createdAt).toBe("number");
    expect(typeof state.lists[0]?.updatedAt).toBe("number");
    expect(state.activeListId).toBe("00000000-0000-0000-0000-000000000001");
    expect(listAdd).toHaveBeenCalledTimes(1);
    uuidSpy.mockRestore();
  });

  it("renames a list and updates timestamps", async () => {
    listsData = [{ id: "list-1", name: "Old", createdAt: 1, updatedAt: 1 }];
    useStore.setState({ lists: [...listsData] });

    await useStore.getState().renameList("list-1", "New");

    const state = useStore.getState();
    expect(state.lists[0]?.name).toBe("New");
    expect(state.lists[0]?.updatedAt).toBe(Date.now());
    expect(listUpdate).toHaveBeenCalledWith("list-1", {
      name: "New",
      updatedAt: Date.now(),
    });
  });

  it("adds an item to the list", async () => {
    const uuidSpy = vi
      .spyOn(globalThis.crypto, "randomUUID")
      .mockReturnValue("00000000-0000-0000-0000-000000000002");

    await useStore.getState().addItem("list-1", "Milk", "2L");

    const state = useStore.getState();
    expect(state.items).toHaveLength(1);
    expect(state.items[0]?.id).toBe("00000000-0000-0000-0000-000000000002");
    expect(state.items[0]?.name).toBe("Milk");
    expect(state.items[0]?.category).toBe("milkCheese");
    expect(state.items[0]?.deleted).toBe(false);
    expect(typeof state.items[0]?.createdAt).toBe("number");
    expect(typeof state.items[0]?.updatedAt).toBe("number");
    expect(itemAdd).toHaveBeenCalledTimes(1);

    uuidSpy.mockRestore();
  });

  it("does not block item creation on backend sync", async () => {
    let resolveSync: (() => void) | undefined;
    upsertItemMock.mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          resolveSync = resolve;
        }),
    );
    fetchListMock.mockImplementation(() => new Promise(() => undefined));

    useStore.setState({
      metadata: {
        id: "app",
        deviceId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
        appVersion: "test-version",
        lastOpenedAt: 1,
      },
      lists: [{ id: "list-1", name: "Groceries", createdAt: 1, updatedAt: 1 }],
    });

    let addResolved = false;
    const addPromise = useStore.getState().addItem("list-1", "Bread").then(() => {
      addResolved = true;
    });

    await Promise.resolve();
    await Promise.resolve();

    expect(addResolved).toBe(true);
    expect(useStore.getState().items.some((item) => item.name === "Bread")).toBe(true);
    expect(upsertItemMock).toHaveBeenCalled();

    resolveSync?.();
    await addPromise;
  });

  it("toggles an item deleted state", async () => {
    const baseItem: Item = {
      id: "item-1",
      listId: "list-1",
      name: "Milk",
      quantityOrUnit: "2L",
      category: "other",
      deleted: false,
      createdAt: 1,
      updatedAt: 1,
    };
    itemsData = [baseItem];
    useStore.setState({ items: [baseItem] });

    await useStore.getState().toggleItem("item-1");

    const state = useStore.getState();
    expect(state.items[0]?.deleted).toBe(true);
    expect(itemPut).toHaveBeenCalledWith(
      expect.objectContaining({
        id: "item-1",
        deleted: true,
      }),
    );
  });

  it("deletes a list with its items and updates active list", async () => {
    listsData = [
      { id: "list-1", name: "One", createdAt: 1, updatedAt: 1 },
      { id: "list-2", name: "Two", createdAt: 2, updatedAt: 2 },
    ];
    itemsData = [
      {
        id: "item-1",
        listId: "list-1",
        name: "Milk",
        category: "other",
        deleted: false,
        createdAt: 1,
        updatedAt: 1,
      },
      {
        id: "item-2",
        listId: "list-2",
        name: "Apples",
        category: "fruitsVegetables",
        deleted: false,
        createdAt: 2,
        updatedAt: 2,
      },
    ];
    useStore.setState({ lists: [...listsData], items: [...itemsData], activeListId: "list-1" });

    await useStore.getState().deleteList("list-1");

    const state = useStore.getState();
    expect(state.lists.map((list) => list.id)).toEqual(["list-2"]);
    expect(state.items.map((item) => item.id)).toEqual(["item-2"]);
    expect(state.activeListId).toBe("list-2");
    expect(listDelete).toHaveBeenCalledWith("list-1");
    expect(itemsWhere).toHaveBeenCalledWith("listId");
  });

  it("syncAllLists syncs local list changes without share tokens", async () => {
    useStore.setState({
      lists: [{ id: "list-1", name: "Groceries", createdAt: 1, updatedAt: 1 }],
      items: [
        {
          id: "item-1",
          listId: "list-1",
          name: "Milk",
          category: "milkCheese",
          deleted: false,
          createdAt: 1,
          updatedAt: 2,
        },
      ],
      metadata: {
        id: "app",
        deviceId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
        appVersion: "test-version",
        lastOpenedAt: 1,
      },
      listShareTokens: {},
    });

    upsertListMock.mockResolvedValue({ listId: "list-1" });
    fetchListMock
      .mockResolvedValueOnce({
        listId: "list-1",
        name: "Groceries",
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-01T00:00:00.000Z",
        items: [],
      })
      .mockResolvedValueOnce({
        listId: "list-1",
        name: "Groceries",
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-01T00:00:00.000Z",
        items: [
          {
            id: "item-1",
            name: "Milk",
            category: "milkCheese",
            deleted: false,
            createdAt: "2026-01-01T00:00:00.000Z",
            updatedAt: "2026-01-01T00:00:00.000Z",
          },
        ],
      });

    await useStore.getState().syncAllLists();

    expect(createShareTokenMock).not.toHaveBeenCalled();
    expect(upsertListMock).not.toHaveBeenCalled();
    expect(fetchListMock).toHaveBeenCalledWith({
      deviceId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      listId: "list-1",
    });
    expect(upsertItemMock).toHaveBeenCalled();
  });
});
