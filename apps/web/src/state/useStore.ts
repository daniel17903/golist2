import { create } from "zustand";
import type { AppMetadata, Item, List } from "@golist/shared/domain/types";
import { getCategoryIdForItem, getItemIconName } from "../domain/categories";
import { db } from "../storage/db";
import { t } from "../i18n";
import {
  extractShareToken,
  setBackendCallLogger,
  sharingApiClient,
  setActiveBackendRequestLogger,
  isBackendSharingEnabled,
} from "../sharing/apiClient";

const createId = () => crypto.randomUUID();
const appVersion = __APP_VERSION__;
const selectedListStorageKey = "golist.selectedListId";

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

const getStoredSelectedListId = (): string | undefined =>
  localStorage.getItem(selectedListStorageKey) ?? undefined;

const persistSelectedListId = (listId: string | undefined) => {
  if (!listId) {
    localStorage.removeItem(selectedListStorageKey);
    return;
  }

  localStorage.setItem(selectedListStorageKey, listId);
};

type StoreState = {
  lists: List[];
  items: Item[];
  metadata?: AppMetadata;
  activeListId?: string;
  backendConnection: "unknown" | "online" | "offline";
  syncNotice?: { id: string; message: string };
  backendLogs: Array<{ id: string; message: string; outcome: "success" | "error" | "skipped" }>;
  backendBusyRequests: number;
  backendSharingEnabled: boolean;
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
  clearSyncNotice: () => void;
  appendBackendLog: (entry: { message: string; outcome: "success" | "error" | "skipped" }) => void;
};

const triggerSyncInBackground = (listId: string) => {
  void useStore
    .getState()
    .syncList(listId)
    .catch(() => undefined);
};

const syncListNameImmediately = async (listId: string, listName: string) => {
  const state = useStore.getState();
  if (!state.metadata?.deviceId) {
    logSkippedBackendCall("List name sync skipped: device metadata missing.");
    return;
  }

  await sharingApiClient.upsertList({
    deviceId: state.metadata.deviceId,
    listId,
    body: {
      name: listName,
    },
  });

  markBackendOnline();
};

const syncItemImmediately = async (item: Item) => {
  const state = useStore.getState();
  if (!state.metadata?.deviceId) {
    logSkippedBackendCall("Item sync skipped: device metadata missing.");
    return;
  }

  await sharingApiClient.upsertItem({
    deviceId: state.metadata.deviceId,
    listId: item.listId,
    itemId: item.id,
    body: {
      name: item.name,
      iconName: item.iconName,
      quantityOrUnit: item.quantityOrUnit,
      category: item.category,
      deleted: item.deleted,
      updatedAt: toIsoTimestamp(item.updatedAt),
    },
  });

  markBackendOnline();
};


const markBackendOnline = () => {
  useStore.setState({ backendConnection: "online" });
};

const describeSyncError = (error: unknown) => {
  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }
  return null;
};

const isFetchListForbiddenError = (error: unknown) =>
  error instanceof Error && /fetch list failed:\s*403\b/i.test(error.message);

const reportSyncError = (message: string) => {
  useStore.setState({
    backendConnection: "offline",
    syncNotice: {
      id: crypto.randomUUID(),
      message,
    },
  });

  useStore.getState().appendBackendLog({
    message,
    outcome: "error",
  });
};

const logSkippedBackendCall = (reason: string) => {
  useStore.getState().appendBackendLog({
    message: reason,
    outcome: "skipped",
  });
};

const runBackendSyncInBackground = (action: () => Promise<void>, message: string) => {
  if (!isBackendSharingEnabled) {
    return;
  }

  void action().catch((error) => {
    const details = describeSyncError(error);
    reportSyncError(
      details
        ? `${message} (${details}). ${t("sync.pending")}`
        : `${message}. ${t("sync.pending")}`,
    );
  });
};

export const useStore = create<StoreState>((set, get) => ({
  lists: [],
  items: [],
  isLoaded: false,
  activeListId: undefined,
  backendConnection: isBackendSharingEnabled ? "unknown" : "offline",
  syncNotice: undefined,
  backendLogs: [],
  backendBusyRequests: 0,
  backendSharingEnabled: isBackendSharingEnabled,
  load: async () => {
    const [lists, items] = await Promise.all([
      db.lists.toArray(),
      db.items.toArray(),
    ]);
    const sortedLists = lists.sort((a, b) => a.createdAt - b.createdAt);
    const metadata: AppMetadata = {
      id: "app",
      deviceId: getOrCreateDeviceId(),
      appVersion,
      lastOpenedAt: Date.now(),
    };
    await db.metadata.put(metadata);
    const storedSelectedListId = getStoredSelectedListId();
    const initialActiveListId = sortedLists.some((list) => list.id === storedSelectedListId)
      ? storedSelectedListId
      : sortedLists[0]?.id;

    persistSelectedListId(initialActiveListId);
    set({
      lists: sortedLists,
      items,
      activeListId: initialActiveListId,
      metadata,
      isLoaded: true,
    });

    if (isBackendSharingEnabled) {
      void get().syncAllLists();
    }
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
    persistSelectedListId(list.id);
    set((state) => ({
      lists: [...state.lists, list],
      activeListId: list.id,
    }));

    runBackendSyncInBackground(
      () => syncListNameImmediately(list.id, list.name),
      t("sync.offline"),
    );

    triggerSyncInBackground(list.id);
  },
  renameList: async (listId: string, name: string) => {
    const now = Date.now();
    await db.lists.update(listId, { name, updatedAt: now });
    set((state) => ({
      lists: state.lists.map((list) =>
        list.id === listId ? { ...list, name, updatedAt: now } : list,
      ),
    }));
    runBackendSyncInBackground(
      () => syncListNameImmediately(listId, name),
      t("sync.offline"),
    );

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
      persistSelectedListId(nextActiveListId);
      return {
        lists: remainingLists,
        items: state.items.filter((item) => item.listId !== listId),
        activeListId: nextActiveListId,
      };
    });
  },
  setActiveList: (listId: string) => {
    persistSelectedListId(listId);
    set({ activeListId: listId });
  },
  addItem: async (listId: string, name: string, quantityOrUnit?: string) => {
    const now = Date.now();
    const item: Item = {
      id: createId(),
      listId,
      name,
      quantityOrUnit,
      iconName: getItemIconName(name) ?? "default",
      category: getCategoryIdForItem(name) ?? "other",
      deleted: false,
      createdAt: now,
      updatedAt: now,
    };
    await db.items.add(item);
    set((state) => ({ items: [...state.items, item] }));
    runBackendSyncInBackground(() => syncItemImmediately(item), t("sync.offline"));

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

    runBackendSyncInBackground(
      () => syncItemImmediately(updated),
      t("sync.offline"),
    );

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
      iconName: getItemIconName(name) ?? "default",
      category: getCategoryIdForItem(name) ?? "other",
      updatedAt: Date.now(),
    };
    await db.items.put(updated);
    set((state) => ({
      items: state.items.map((entry) => (entry.id === itemId ? updated : entry)),
    }));

    runBackendSyncInBackground(
      () => syncItemImmediately(updated),
      t("sync.offline"),
    );

    triggerSyncInBackground(updated.listId);
  },
  ensureShareToken: async (listId: string) => {
    const state = get();
    if (!isBackendSharingEnabled) {
      throw new Error("Backend sharing is disabled");
    }

    const list = state.lists.find((entry) => entry.id === listId);
    if (!list || !state.metadata?.deviceId) {
      throw new Error("List or device metadata missing");
    }

    await sharingApiClient.upsertList({
      deviceId: state.metadata.deviceId,
      listId: list.id,
      body: { name: list.name },
    });

    const tokenResponse = await sharingApiClient.createShareToken({
      deviceId: state.metadata.deviceId,
      listId: list.id,
    });

    markBackendOnline();
    return tokenResponse.shareToken;
  },
  joinSharedList: async (rawShareValue: string) => {
    const state = get();
    if (!isBackendSharingEnabled) {
      throw new Error("Backend sharing is disabled");
    }

    if (!state.metadata?.deviceId) {
      throw new Error("Device metadata missing");
    }

    const shareToken = extractShareToken(rawShareValue);
    if (!shareToken) {
      throw new Error("Invalid share token");
    }

    try {
      const redemption = await sharingApiClient.redeemShareToken({
        deviceId: state.metadata.deviceId,
        shareToken,
      });

      const remoteList = await sharingApiClient.fetchList({
        deviceId: state.metadata.deviceId,
        listId: redemption.listId,
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
        iconName: item.iconName,
        quantityOrUnit: item.quantityOrUnit,
        category: item.category,
        deleted: item.deleted,
        createdAt: toMillis(item.createdAt),
        updatedAt: toMillis(item.updatedAt),
      }));

      const syncedAt = Date.now();
      await db.lists.put(localList);
      await db.items.bulkPut(localItems);
      await db.listShares.put({
        listId: localList.id,
        lastSyncedAt: syncedAt,
      });
      persistSelectedListId(localList.id);
      set((current) => {
        const withoutListItems = current.items.filter((item) => item.listId !== localList.id);
        const withoutList = current.lists.filter((list) => list.id !== localList.id);
        return {
          lists: [...withoutList, localList].sort((a, b) => a.createdAt - b.createdAt),
          items: [...withoutListItems, ...localItems],
          activeListId: localList.id,
        };
      });

      markBackendOnline();
      return localList.id;
    } catch (error) {
      const details = describeSyncError(error);
      reportSyncError(
        details
          ? `Geteilte Liste konnte nicht geladen werden (${details}). Bitte Backend-Verbindung prüfen.`
          : "Geteilte Liste konnte nicht geladen werden. Bitte Backend-Verbindung prüfen.",
      );
      throw error;
    }
  },
  syncList: async (listId: string) => {
    const state = get();
    if (!isBackendSharingEnabled || !state.metadata?.deviceId) {
      return;
    }

    const localList = state.lists.find((entry) => entry.id === listId);
    if (!localList) {
      return;
    }

    const deviceId = state.metadata.deviceId;
    const localItemsForList = state.items.filter((item) => item.listId === listId);
    const localItemMap = new Map(localItemsForList.map((item) => [item.id, item]));
    const listShare = await db.listShares.get(listId);
    const previousLastSyncedAt = listShare?.lastSyncedAt;

    let remoteList;

    try {
      remoteList = await sharingApiClient.fetchList({ deviceId, listId });
    } catch (error) {
      if (!isFetchListForbiddenError(error)) {
        throw error;
      }

      await sharingApiClient.upsertList({
        deviceId,
        listId,
        body: { name: localList.name },
      });
      remoteList = await sharingApiClient.fetchList({ deviceId, listId });
    }

    const remoteListUpdatedAt = toMillis(remoteList.updatedAt);
    if (localList.updatedAt > remoteListUpdatedAt || localList.name !== remoteList.name) {
      await sharingApiClient.upsertList({
        deviceId,
        listId,
        body: { name: localList.name },
      });
    }

    const localPushById = new Map<string, Item>();
    for (const localItem of localItemsForList) {
      if (
        !previousLastSyncedAt
        || localItem.updatedAt > previousLastSyncedAt
        || localItem.createdAt > previousLastSyncedAt
      ) {
        localPushById.set(localItem.id, localItem);
      }
    }

    for (const item of localPushById.values()) {
      await sharingApiClient.upsertItem({
        deviceId,
        listId,
        itemId: item.id,
        body: {
          name: item.name,
          iconName: item.iconName,
          quantityOrUnit: item.quantityOrUnit,
          category: item.category,
          deleted: item.deleted,
          updatedAt: toIsoTimestamp(item.updatedAt),
        },
      });
    }

    const now = Date.now();
    const updatedAfterIso = toIsoTimestamp(previousLastSyncedAt ?? 0);
    const remoteItemsResponse = await sharingApiClient.fetchItemsUpdatedAfter({
      deviceId,
      listId,
      updatedAfter: updatedAfterIso,
    });

    const remoteSyncedItems: Item[] = remoteItemsResponse.items.map((item) => ({
      id: item.id,
      listId,
      name: item.name,
      iconName: item.iconName,
      quantityOrUnit: item.quantityOrUnit,
      category: item.category,
      deleted: item.deleted,
      createdAt: toMillis(item.createdAt),
      updatedAt: toMillis(item.updatedAt),
    }));

    const remoteItemsById = new Map(remoteSyncedItems.map((item) => [item.id, item]));
    const nextItemsForList = localItemsForList.map((item) => remoteItemsById.get(item.id) ?? item);
    for (const remoteItem of remoteSyncedItems) {
      if (!localItemMap.has(remoteItem.id)) {
        nextItemsForList.push(remoteItem);
      }
    }

    const syncedList: List = {
      id: remoteList.listId,
      name: remoteList.name,
      createdAt: toMillis(remoteList.createdAt),
      updatedAt: toMillis(remoteList.updatedAt),
    };

    await db.lists.put(syncedList);
    if (remoteSyncedItems.length > 0) {
      await db.items.bulkPut(remoteSyncedItems);
    }
    await db.listShares.put({
      listId,
      lastSyncedAt: now,
    });

    set((current) => {
      const remainingLists = current.lists.filter((entry) => entry.id !== listId);
      const remainingItems = current.items.filter((entry) => entry.listId !== listId);
      return {
        lists: [...remainingLists, syncedList].sort((a, b) => a.createdAt - b.createdAt),
        items: [...remainingItems, ...nextItemsForList],
      };
    });

    markBackendOnline();
  },
  syncAllLists: async () => {
    const state = get();
    if (!isBackendSharingEnabled) {
      return;
    }

    await Promise.all(
      state.lists.map(async (list) => {
        try {
          await get().syncList(list.id);
        } catch (error) {
          const details = describeSyncError(error);
          reportSyncError(
            details
              ? `Backend derzeit nicht erreichbar (${details}). Synchronisierung wird erneut versucht.`
              : "Backend derzeit nicht erreichbar. Synchronisierung wird erneut versucht.",
          );
        }
      }),
    );
  },
  clearSyncNotice: () => set({ syncNotice: undefined }),
  appendBackendLog: (entry) =>
    set((state) => ({
      backendLogs: [
        ...state.backendLogs.slice(-49),
        { id: crypto.randomUUID(), message: entry.message, outcome: entry.outcome },
      ],
    })),
}));

setBackendCallLogger((entry) => {
  useStore.getState().appendBackendLog({
    message: `${entry.endpoint}: ${entry.message}`,
    outcome: entry.outcome,
  });
});


setActiveBackendRequestLogger((count) => {
  useStore.setState({ backendBusyRequests: count });
});
