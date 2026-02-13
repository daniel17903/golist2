import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Item, List } from "@golist/shared/domain/types";

vi.stubGlobal("__APP_VERSION__", "test-version");

let listsData: List[] = [];
let itemsData: Item[] = [];
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
  itemsData = itemsData.map((entry) => (entry.id === item.id ? item : entry));
});
const itemsWhere = vi.fn((field: keyof Item) => ({
  equals: (value: Item[keyof Item]) => ({
    delete: vi.fn(async () => {
      if (field === "listId") {
        itemsData = itemsData.filter((item) => item.listId !== value);
      }
    })
  })
}));

vi.mock("../storage/db", () => ({
  db: {
    lists: {
      toArray: vi.fn(async () => [...listsData]),
      add: listAdd,
      update: listUpdate,
      delete: listDelete
    },
    items: {
      toArray: vi.fn(async () => [...itemsData]),
      add: itemAdd,
      put: itemPut,
      where: itemsWhere
    },
    metadata: {
      put: metadataPut
    }
  }
}));

const { useStore } = await import("./useStore");

const resetStore = () => {
  useStore.setState({
    lists: [],
    items: [],
    isLoaded: false,
    activeListId: undefined,
    metadata: undefined
  });
};

describe("useStore", () => {
  beforeEach(() => {
    listsData = [];
    itemsData = [];
    metadataPut.mockClear();
    listAdd.mockClear();
    listUpdate.mockClear();
    listDelete.mockClear();
    itemAdd.mockClear();
    itemPut.mockClear();
    itemsWhere.mockClear();
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
      { id: "a", name: "Earlier", createdAt: 1, updatedAt: 1 }
    ];
    itemsData = [
      {
        id: "item-1",
        listId: "a",
        name: "apple",
        checked: false,
        createdAt: 10,
        updatedAt: 10
      }
    ];

    await useStore.getState().load();
    const state = useStore.getState();

    expect(state.lists.map((list) => list.id)).toEqual(["a", "b"]);
    expect(state.items).toHaveLength(1);
    expect(state.activeListId).toBe("a");
    expect(state.metadata?.appVersion).toBe("test-version");
    expect(state.isLoaded).toBe(true);
    expect(metadataPut).toHaveBeenCalledTimes(1);
  });

  it("adds a list and sets it active", async () => {
    const uuidSpy = vi
      .spyOn(globalThis.crypto, "randomUUID")
      .mockReturnValue("00000000-0000-0000-0000-000000000001");

    await useStore.getState().addList("Groceries");

    const state = useStore.getState();
    expect(state.lists).toHaveLength(1);
    expect(state.lists[0]?.name).toBe("Groceries");
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
      updatedAt: Date.now()
    });
  });

  it("adds an item to the list", async () => {
    const uuidSpy = vi
      .spyOn(globalThis.crypto, "randomUUID")
      .mockReturnValue("00000000-0000-0000-0000-000000000002");

    await useStore.getState().addItem("list-1", "Milk", "2L");

    const state = useStore.getState();
    expect(state.items).toHaveLength(1);
    expect(state.items[0]?.name).toBe("Milk");
    expect(itemAdd).toHaveBeenCalledTimes(1);

    uuidSpy.mockRestore();
  });

  it("toggles an item checked state", async () => {
    const baseItem: Item = {
      id: "item-1",
      listId: "list-1",
      name: "Milk",
      quantityOrUnit: "2L",
      checked: false,
      createdAt: 1,
      updatedAt: 1
    };
    itemsData = [baseItem];
    useStore.setState({ items: [baseItem] });

    await useStore.getState().toggleItem("item-1");

    const state = useStore.getState();
    expect(state.items[0]?.checked).toBe(true);
    expect(itemPut).toHaveBeenCalledWith(
      expect.objectContaining({
        id: "item-1",
        checked: true
      })
    );
  });

  it("deletes a list with its items and updates active list", async () => {
    listsData = [
      { id: "list-1", name: "One", createdAt: 1, updatedAt: 1 },
      { id: "list-2", name: "Two", createdAt: 2, updatedAt: 2 }
    ];
    itemsData = [
      {
        id: "item-1",
        listId: "list-1",
        name: "Milk",
        checked: false,
        createdAt: 1,
        updatedAt: 1
      },
      {
        id: "item-2",
        listId: "list-2",
        name: "Apples",
        checked: false,
        createdAt: 2,
        updatedAt: 2
      }
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
});
