import { create } from "zustand";
import type { AppMetadata, Item, List } from "@golist/shared/domain/types";
import { getCategoryForItem } from "../domain/categories";
import { db } from "../storage/db";
import { extractShareToken, sharingApiClient } from "../sharing/apiClient";

const createId = () => crypto.randomUUID();
const appVersion = __APP_VERSION__;

const toIsoTimestamp = (value: number) => new Date(value).toISOString();
const toMillis = (value: string) => new Date(value).getTime();

const getOrCreateDeviceId = (): string => {
  const storageKey = "golist.deviceId";
  const existing = localStorage.getItem(storageKey);
  if (existing) {
    return existing;
  }

  const created = crypto.randomUUID();
  localStorage.setItem(storageKey, created);
  return created;
};

type StoreState = {
  lists: List[];
  items: Item[];
  metadata?: AppMetadata;
  activeListId?: string;
  listShareTokens: Record<string, string>;
  isLoaded: boolean;
  load: () => Promise<void>;
  addList: (name: string) => Promise<void>;
  renameList: (listId: string, name: string) => Promise<void>;
  deleteList: (listId: string) => Promise<void>;
  setActiveList: (listId: string) => void;
  addItem: (listId: string, name: string, quantityOrUnit?: string) => Promise<void>;
  toggleItem: (itemId: string) => Promise<void>;
  updateItem: (itemId: string, name: string, quantityOrUnit?: string) => Promise<void>;
  ensureShareToken: (listId: string) => Promise<string>;
  joinSharedList: (rawShareValue: string) => Promise<string>;
  syncList: (listId: string) => Promise<void>;
  syncAllLists: () => Promise<void>;
};

const loadShareTokenMap = async () => {
  const entries = await db.listShares.toArray();
  return entries.reduce<Record<string, string>>((accumulator, entry) => {
    accumulator[entry.listId] = entry.shareToken;
    return accumulator;
  }, {});
};

const setShareToken = async (listId: string, shareToken: string) => {
  await db.listShares.put({ listId, shareToken, lastSyncedAt: Date.now() });
};

const triggerSyncInBackground = (listId: string) => {
  void useStore
    .getState()
    .syncList(listId)
    .catch(() => undefined);
};

const syncListNameImmediately = async (listId: string, listName: string) => {
  const state = useStore.getState();
  const shareToken = state.listShareTokens[listId];
  if (!shareToken || !state.metadata?.deviceId) {
    return;
  }

  await sharingApiClient.upsertList({
    deviceId: state.metadata.deviceId,
    shareToken,
    body: {
      listId,
      name: listName,
    },
  });
};

const syncItemImmediately = async (item: Item) => {
  const state = useStore.getState();
  const shareToken = state.listShareTokens[item.listId];
  if (!shareToken || !state.metadata?.deviceId) {
    return;
  }

  await sharingApiClient.upsertItem({
    deviceId: state.metadata.deviceId,
    shareToken,
    itemId: item.id,
    body: {
      name: item.name,
      quantityOrUnit: item.quantityOrUnit,
      category: item.category,
      deleted: item.deleted,
      updatedAt: toIsoTimestamp(item.updatedAt),
    },
  });
};

export const useStore = create<StoreState>((set, get) => ({
  lists: [],
  items: [],
  isLoaded: false,
  activeListId: undefined,
  listShareTokens: {},
  load: async () => {
    const [lists, items, listShareTokens] = await Promise.all([
      db.lists.toArray(),
      db.items.toArray(),
      loadShareTokenMap(),
    ]);
    const sortedLists = lists.sort((a, b) => a.createdAt - b.createdAt);
    const metadata: AppMetadata = {
      id: "app",
      deviceId: getOrCreateDeviceId(),
      appVersion,
      lastOpenedAt: Date.now(),
    };
    await db.metadata.put(metadata);
    set({
      lists: sortedLists,
      items,
      activeListId: sortedLists[0]?.id,
      metadata,
      listShareTokens,
      isLoaded: true,
    });

    void get().syncAllLists();
  },
  addList: async (name: string) => {
    const now = Date.now();
    const list: List = {
      id: createId(),
      name,
      createdAt: now,
      updatedAt: now,
    };
    await db.lists.add(list);
    set((state) => ({
      lists: [...state.lists, list],
      activeListId: list.id,
    }));
  },
  renameList: async (listId: string, name: string) => {
    const now = Date.now();
    await db.lists.update(listId, { name, updatedAt: now });
    set((state) => ({
      lists: state.lists.map((list) =>
        list.id === listId ? { ...list, name, updatedAt: now } : list,
      ),
    }));
    try {
      await syncListNameImmediately(listId, name);
    } catch {
      // keep local-first writes responsive when backend is unreachable
    }

    triggerSyncInBackground(listId);
  },
  deleteList: async (listId: string) => {
    await db.items.where("listId").equals(listId).delete();
    await db.lists.delete(listId);
    await db.listShares.delete(listId);
    set((state) => {
      const remainingLists = state.lists.filter((list) => list.id !== listId);
      const nextActiveListId =
        state.activeListId === listId ? remainingLists[0]?.id : state.activeListId;
      const remainingTokens = { ...state.listShareTokens };
      delete remainingTokens[listId];
      return {
        lists: remainingLists,
        items: state.items.filter((item) => item.listId !== listId),
        activeListId: nextActiveListId,
        listShareTokens: remainingTokens,
      };
    });
  },
  setActiveList: (listId: string) => set({ activeListId: listId }),
  addItem: async (listId: string, name: string, quantityOrUnit?: string) => {
    const now = Date.now();
    const item: Item = {
      id: createId(),
      listId,
      name,
      quantityOrUnit,
      category: getCategoryForItem(name)?.id ?? "other",
      deleted: false,
      createdAt: now,
      updatedAt: now,
    };
    await db.items.add(item);
    set((state) => ({ items: [...state.items, item] }));
    try {
      await syncItemImmediately(item);
    } catch {
      // keep local-first writes responsive when backend is unreachable
    }

    triggerSyncInBackground(listId);
  },
  toggleItem: async (itemId: string) => {
    const { items } = get();
    const item = items.find((entry) => entry.id === itemId);
    if (!item) {return;}
    const updated = {
      ...item,
      deleted: !item.deleted,
      updatedAt: Date.now(),
    };
    await db.items.put(updated);
    set((state) => ({
      items: state.items.map((entry) => (entry.id === itemId ? updated : entry)),
    }));

    try {
      await syncItemImmediately(updated);
    } catch {
      // keep local-first writes responsive when backend is unreachable
    }

    triggerSyncInBackground(updated.listId);
  },
  updateItem: async (itemId: string, name: string, quantityOrUnit?: string) => {
    const { items } = get();
    const item = items.find((entry) => entry.id === itemId);
    if (!item) {return;}
    const updated = {
      ...item,
      name,
      quantityOrUnit,
      category: getCategoryForItem(name)?.id ?? "other",
      updatedAt: Date.now(),
    };
    await db.items.put(updated);
    set((state) => ({
      items: state.items.map((entry) => (entry.id === itemId ? updated : entry)),
    }));

    try {
      await syncItemImmediately(updated);
    } catch {
      // keep local-first writes responsive when backend is unreachable
    }

    triggerSyncInBackground(updated.listId);
  },
  ensureShareToken: async (listId: string) => {
    const state = get();
    const existing = state.listShareTokens[listId];
    if (existing) {
      return existing;
    }

    const list = state.lists.find((entry) => entry.id === listId);
    if (!list || !state.metadata?.deviceId) {
      throw new Error("List or device metadata missing");
    }

    const response = await sharingApiClient.upsertList({
      deviceId: state.metadata.deviceId,
      body: { listId: list.id, name: list.name },
    });

    await setShareToken(listId, response.shareToken);
    set((current) => ({
      listShareTokens: {
        ...current.listShareTokens,
        [listId]: response.shareToken,
      },
    }));

    return response.shareToken;
  },
  joinSharedList: async (rawShareValue: string) => {
    const state = get();
    if (!state.metadata?.deviceId) {
      throw new Error("Device metadata missing");
    }

    const shareToken = extractShareToken(rawShareValue);
    if (!shareToken) {
      throw new Error("Invalid share token");
    }

    await sharingApiClient.redeemShareToken({
      deviceId: state.metadata.deviceId,
      shareToken,
    });

    const remoteList = await sharingApiClient.fetchList({
      deviceId: state.metadata.deviceId,
      shareToken,
    });

    const localList: List = {
      id: remoteList.listId,
      name: remoteList.name,
      createdAt: toMillis(remoteList.createdAt),
      updatedAt: toMillis(remoteList.updatedAt),
    };

    const localItems: Item[] = remoteList.items.map((item) => ({
      id: item.id,
      listId: remoteList.listId,
      name: item.name,
      quantityOrUnit: item.quantityOrUnit,
      category: item.category,
      deleted: item.deleted,
      createdAt: toMillis(item.createdAt),
      updatedAt: toMillis(item.updatedAt),
    }));

    await db.lists.put(localList);
    await db.items.bulkPut(localItems);
    await setShareToken(localList.id, shareToken);

    set((current) => {
      const withoutListItems = current.items.filter((item) => item.listId !== localList.id);
      const withoutList = current.lists.filter((list) => list.id !== localList.id);
      return {
        lists: [...withoutList, localList].sort((a, b) => a.createdAt - b.createdAt),
        items: [...withoutListItems, ...localItems],
        activeListId: localList.id,
        listShareTokens: {
          ...current.listShareTokens,
          [localList.id]: shareToken,
        },
      };
    });

    return localList.id;
  },
  syncList: async (listId: string) => {
    const state = get();
    const shareToken = state.listShareTokens[listId];
    if (!shareToken || !state.metadata?.deviceId) {
      return;
    }

    const localList = state.lists.find((entry) => entry.id === listId);
    if (!localList) {
      return;
    }

    const deviceId = state.metadata.deviceId;
    const remoteList = await sharingApiClient.fetchList({ deviceId, shareToken });

    const remoteListUpdatedAt = toMillis(remoteList.updatedAt);
    if (localList.updatedAt > remoteListUpdatedAt || localList.name !== remoteList.name) {
      await sharingApiClient.upsertList({
        deviceId,
        shareToken,
        body: { listId, name: localList.name },
      });
    }

    const localItemsForList = state.items.filter((item) => item.listId === listId);
    const localItemMap = new Map(localItemsForList.map((item) => [item.id, item]));
    const localPushById = new Map<string, Item>();

    for (const remoteItem of remoteList.items) {
      const local = localItemMap.get(remoteItem.id);
      const remoteUpdatedAt = toMillis(remoteItem.updatedAt);
      if (!local || local.updatedAt > remoteUpdatedAt) {
        if (local) {
          localPushById.set(local.id, local);
        }
      }
    }

    const remoteIds = new Set(remoteList.items.map((item) => item.id));
    for (const local of localItemsForList) {
      if (!remoteIds.has(local.id)) {
        localPushById.set(local.id, local);
      }
    }

    for (const item of localPushById.values()) {
      await sharingApiClient.upsertItem({
        deviceId,
        shareToken,
        itemId: item.id,
        body: {
          name: item.name,
          quantityOrUnit: item.quantityOrUnit,
          category: item.category,
          deleted: item.deleted,
          updatedAt: toIsoTimestamp(item.updatedAt),
        },
      });
    }

    const refreshedList = await sharingApiClient.fetchList({ deviceId, shareToken });
    const syncedList: List = {
      id: refreshedList.listId,
      name: refreshedList.name,
      createdAt: toMillis(refreshedList.createdAt),
      updatedAt: toMillis(refreshedList.updatedAt),
    };
    const syncedItems: Item[] = refreshedList.items.map((item) => ({
      id: item.id,
      listId,
      name: item.name,
      quantityOrUnit: item.quantityOrUnit,
      category: item.category,
      deleted: item.deleted,
      createdAt: toMillis(item.createdAt),
      updatedAt: toMillis(item.updatedAt),
    }));

    const now = Date.now();
    await db.lists.put(syncedList);
    await db.items.bulkPut(syncedItems);
    await db.listShares.put({ listId, shareToken, lastSyncedAt: now });

    set((current) => {
      const remainingLists = current.lists.filter((entry) => entry.id !== listId);
      const remainingItems = current.items.filter((entry) => entry.listId !== listId);
      return {
        lists: [...remainingLists, syncedList].sort((a, b) => a.createdAt - b.createdAt),
        items: [...remainingItems, ...syncedItems],
      };
    });
  },
  syncAllLists: async () => {
    const state = get();
    await Promise.all(
      Object.keys(state.listShareTokens).map(async (listId) => {
        try {
          await get().syncList(listId);
        } catch {
          // offline or unreachable backend should not break local-first behavior
        }
      }),
    );
  },
}));
