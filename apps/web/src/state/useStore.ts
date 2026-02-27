import { create } from "zustand";
import type { AppMetadata, Item, List } from "@golist/shared/domain/types";
import { buildItemHash } from "@golist/shared/domain/sync";
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
import { socketSyncManager } from "../sharing/socketSync";

const createId = () => crypto.randomUUID();
const appVersion = __APP_VERSION__;
const selectedListStorageKey = "golist.selectedListId";

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


const syncItemFallbackImmediately = async (item: Item) => {
  const state = useStore.getState();
  if (!state.metadata?.deviceId) {
    logSkippedBackendCall("Item fallback sync skipped: device metadata missing.");
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
      updatedAt: new Date(item.updatedAt).toISOString(),
    },
  });

  markBackendOnline();
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

  await sharingApiClient.fetchList({
    deviceId: state.metadata.deviceId,
    listId,
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
      socketSyncManager.init(metadata.deviceId, {
        getItemsForList: (listId) => useStore.getState().items.filter((item) => item.listId === listId),
        applyIncomingItems: async (listId, incomingItems) => {
          const currentState = useStore.getState();
          const localById = new Map(
            currentState.items.filter((item) => item.listId === listId).map((item) => [item.id, item]),
          );

          const acceptedItems = incomingItems.filter((incoming) => {
            const localItem = localById.get(incoming.id);
            if (!localItem) {
              return true;
            }
            if (incoming.updatedAt > localItem.updatedAt) {
              return true;
            }
            if (incoming.updatedAt < localItem.updatedAt) {
              return false;
            }
            return buildItemHash(incoming) >= buildItemHash(localItem);
          });

          if (acceptedItems.length === 0) {
            return;
          }

          await db.items.bulkPut(acceptedItems);
          useStore.setState((state) => {
            const mergedById = new Map(state.items.map((item) => [item.id, item]));
            for (const accepted of acceptedItems) {
              mergedById.set(accepted.id, accepted);
            }
            return { items: Array.from(mergedById.values()) };
          });
        },
        onConnectionState: (connectionState) => {
          useStore.setState({ backendConnection: connectionState });
        },
        onError: (message) => {
          reportSyncError(`${message} ${t("sync.pending")}`);
        },
      });
      socketSyncManager.setActiveList(initialActiveListId);
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

    socketSyncManager.setActiveList(list.id);
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
      socketSyncManager.setActiveList(nextActiveListId);
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
    socketSyncManager.setActiveList(listId);
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
    socketSyncManager.queueLocalItemPatch(item);
    if (!socketSyncManager.canSyncList(listId)) {
      runBackendSyncInBackground(() => syncItemFallbackImmediately(item), t("sync.offline"));
    }
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

    socketSyncManager.queueLocalItemPatch(updated);
    if (!socketSyncManager.canSyncList(updated.listId)) {
      runBackendSyncInBackground(() => syncItemFallbackImmediately(updated), t("sync.offline"));
    }
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

    socketSyncManager.queueLocalItemPatch(updated);
    if (!socketSyncManager.canSyncList(updated.listId)) {
      runBackendSyncInBackground(() => syncItemFallbackImmediately(updated), t("sync.offline"));
    }
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
      socketSyncManager.setActiveList(localList.id);
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
    if (!isBackendSharingEnabled) {
      return;
    }

    socketSyncManager.setActiveList(listId);
    socketSyncManager.requestResync();
  },
  syncAllLists: async () => {
    if (!isBackendSharingEnabled) {
      return;
    }

    socketSyncManager.requestResync();
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
