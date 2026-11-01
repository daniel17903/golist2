import { create } from "zustand";
import { defaultListType, type AppMetadata, type Item, type List, type ListType } from "@golist/shared/domain/types";
import { shouldAcceptItem, shouldAcceptListMetadata } from "@golist/shared/domain/sync";
import { getCategoryAndIcon, getItemIconName } from "../domain/categories";
import { computeNextDueDate } from "../domain/recurrence";
import { db as defaultDb, type GoListDatabase } from "../storage/db";
import { t } from "../i18n";
import type { Locale } from "../i18n/config";
import {
  extractShareToken,
  setBackendCallLogger,
  sharingApiClient,
  setActiveBackendRequestLogger,
  isBackendSharingEnabled,
  type SharingApiClient,
} from "../sharing/apiClient";
import { socketSyncManager, type SocketSyncManager } from "../sharing/socketSync";
import { createStoreSyncCallbacks } from "../sharing/storeSyncBridge";

const selectedListStorageKey = "golist.selectedListId";

const toMillis = (value: string) => new Date(value).getTime();

type KeyValueStorage = Pick<Storage, "getItem" | "setItem" | "removeItem">;

// Everything the store touches outside itself. The app uses
// `defaultEnvironment` (browser globals + module singletons); the sync
// simulation (apps/web/sim) builds one store per virtual device with its own
// database, storage, network-controlled API client/socket and clock.
export type GoListStoreEnvironment = {
  db: GoListDatabase;
  api: SharingApiClient;
  isBackendSharingEnabled: boolean;
  setBackendCallLogger: typeof setBackendCallLogger;
  setActiveBackendRequestLogger: typeof setActiveBackendRequestLogger;
  sync: Pick<
    SocketSyncManager,
    "init" | "setActiveList" | "queueLocalItemPatch" | "queueLocalListMetadataPatch" | "requestResync" | "forceReconnect"
  >;
  storage: KeyValueStorage;
  now: () => number;
  createId: () => string;
  appVersion: string;
};

/** The editable fields of a todo (its title is stored as the item `name`). */
export type TodoInput = {
  title: string;
  description?: string;
  points?: number;
  dueDate?: number;
  assignedTo?: string;
  recurrence?: string;
};

export type StoreState = {
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
  addList: (name: string, listType?: ListType) => Promise<void>;
  renameList: (listId: string, name: string) => Promise<void>;
  setListType: (listId: string, listType: ListType) => Promise<void>;
  deleteList: (listId: string) => Promise<void>;
  setActiveList: (listId: string) => void;
  addItem: (listId: string, name: string, quantityOrUnit?: string) => Promise<void>;
  recategorizeSuggestedItems: (
    itemUpdates: Array<{ itemId: string; category: string }>,
    locale: Locale,
  ) => Promise<void>;
  toggleItem: (itemId: string) => Promise<void>;
  updateItem: (itemId: string, name: string, quantityOrUnit?: string) => Promise<void>;
  addTodo: (listId: string, input: TodoInput) => Promise<void>;
  updateTodo: (itemId: string, input: TodoInput) => Promise<void>;
  /**
   * Checks a todo off (or reopens it). Completing a recurring todo with a due
   * date also creates its next occurrence, whose id is returned so an undo
   * can remove it again.
   */
  toggleTodoCompleted: (itemId: string) => Promise<{ spawnedItemId?: string }>;
  /** Reverts `toggleTodoCompleted`: reopens the todo and deletes the spawned occurrence. */
  undoTodoCompleted: (itemId: string, spawnedItemId?: string) => Promise<void>;
  ensureShareToken: (listId: string) => Promise<string>;
  joinSharedList: (rawShareValue: string) => Promise<string>;
  syncAllLists: () => Promise<void>;
  refreshRealtimeConnection: () => Promise<"success" | "failed">;
  clearSyncNotice: () => void;
  appendBackendLog: (entry: { message: string; outcome: "success" | "error" | "skipped" }) => void;
};


export const createGoListStore = (env: GoListStoreEnvironment) => {
  const { db, api, sync, storage, createId } = env;
  const clock = env.now;
  const backendSharingEnabled = env.isBackendSharingEnabled;

  const getOrCreateDeviceId = (): string => {
    const storageKey = "golist.deviceId";
    const existing = storage.getItem(storageKey);
    if (existing) {
      return existing;
    }

    const created = createId();
    storage.setItem(storageKey, created);
    return created;
  };

  // Timestamp for a local edit of a record last changed at `previous`.
  // Always newer than the version being edited, even when this device's
  // clock is behind the device that wrote it — otherwise last-write-wins
  // would silently discard the edit (found by the sync fuzzer; see
  // sim/scenarios/sync.sim.test.ts "clock skew").
  const nextUpdatedAt = (previous: number) => Math.max(clock(), previous + 1);

  const getStoredSelectedListId = (): string | undefined =>
    storage.getItem(selectedListStorageKey) ?? undefined;

  const persistSelectedListId = (listId: string | undefined) => {
    if (!listId) {
      storage.removeItem(selectedListStorageKey);
      return;
    }

    storage.setItem(selectedListStorageKey, listId);
  };

  const syncListNameImmediately = async (listId: string, listName: string, updatedAt: number, listType?: ListType) => {
    const state = store.getState();
    if (!state.metadata?.deviceId) {
      logSkippedBackendCall("List name sync skipped: device metadata missing.");
      return;
    }

    await api.upsertList({
      deviceId: state.metadata.deviceId,
      listId,
      body: {
        name: listName,
        listType,
        updatedAt: new Date(updatedAt).toISOString(),
      },
    });

    await api.fetchList({
      deviceId: state.metadata.deviceId,
      listId,
    });

    // Now that the backend knows the list, retry the subscription for whatever
    // list is active *now* — not `listId`: the user (or a share-link join) may
    // have switched lists during the REST round trip, and re-subscribing to
    // `listId` would leave the visible list without realtime updates.
    sync.setActiveList(store.getState().activeListId);
    markBackendOnline();
  };


  const markBackendOnline = () => {
    store.setState({ backendConnection: "online" });
  };

  const describeSyncError = (error: unknown) => {
    if (error instanceof Error && error.message.trim()) {
      return error.message;
    }
    return null;
  };


  const reportSyncError = (message: string) => {
    store.setState({
      backendConnection: "offline",
      syncNotice: {
        id: createId(),
        message,
      },
    });

    store.getState().appendBackendLog({
      message,
      outcome: "error",
    });
  };

  const logSkippedBackendCall = (reason: string) => {
    store.getState().appendBackendLog({
      message: reason,
      outcome: "skipped",
    });
  };

  const runBackendSyncInBackground = (action: () => Promise<void>, message: string) => {
    if (!backendSharingEnabled) {
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

  // A lazily-rebuilt id -> array-index cache for the current `items` array.
  // Item mutations are dominated by single-item changes (one checkbox toggle,
  // one added item) while `items` itself can hold years of history across
  // every list, so an O(item count) `.map()`/`.find()` on every mutation does
  // not scale. The cache is keyed by array *reference*: any code path that
  // replaces `items` wholesale (list deletion, list join, boot load,
  // background hydration) naturally invalidates it just by producing a new
  // array reference, and the next lookup below rebuilds it lazily — no manual
  // bookkeeping is required at those call sites.
  let itemIndexCache: { items: Item[]; positionById: Map<string, number> } | null = null;

  const getItemPositionIndex = (items: Item[]): Map<string, number> => {
    if (itemIndexCache?.items !== items) {
      itemIndexCache = {
        items,
        positionById: new Map(items.map((item, index) => [item.id, index])),
      };
    }
    return itemIndexCache.positionById;
  };

  const findItemById = (items: Item[], itemId: string): Item | undefined => {
    const position = getItemPositionIndex(items).get(itemId);
    return position !== undefined ? items[position] : undefined;
  };

  // Replaces existing entries in place (preserving list order) and appends
  // entries that are new. Patches only the positions that actually changed
  // instead of mapping over the whole array, using the position cache above —
  // so a single-item mutation costs O(current item count) for one array copy
  // (a fast reference-only `.slice()`) plus O(changed items) work, instead of
  // re-running per-element lookup logic across every list's full history.
  const mergeItemsById = (currentItems: Item[], changedItems: Item[]): Item[] => {
    if (changedItems.length === 0) {
      return currentItems;
    }

    const positionById = getItemPositionIndex(currentItems);
    const merged = currentItems.slice();
    for (const changed of changedItems) {
      const position = positionById.get(changed.id);
      if (position !== undefined && merged[position]?.id === changed.id) {
        merged[position] = changed;
      } else {
        positionById.set(changed.id, merged.length);
        merged.push(changed);
      }
    }
    itemIndexCache = { items: merged, positionById };
    return merged;
  };

  // Shared write path for locally-changed items: persist to Dexie, patch the
  // in-memory items and queue each change for websocket sync.
  const applyLocalItemChanges = async (changedItems: Item[]) => {
    await db.items.bulkPut(changedItems);
    store.setState((state) => ({ items: mergeItemsById(state.items, changedItems) }));
    changedItems.forEach((item) => sync.queueLocalItemPatch(item));
  };

  // Shared write path for list metadata (name + type): both sync together as
  // one last-write-wins record.
  const updateListMetadata = async (listId: string, changes: { name?: string; listType?: ListType }) => {
    const current = store.getState().lists.find((list) => list.id === listId);
    if (!current) {
      return;
    }
    const next: List = {
      ...current,
      name: changes.name ?? current.name,
      listType: changes.listType ?? current.listType,
      updatedAt: nextUpdatedAt(current.updatedAt),
    };
    await db.lists.update(listId, { name: next.name, listType: next.listType, updatedAt: next.updatedAt });
    store.setState((state) => ({
      lists: state.lists.map((list) => (list.id === listId ? next : list)),
    }));
    runBackendSyncInBackground(
      () => syncListNameImmediately(listId, next.name, next.updatedAt, next.listType),
      t("sync.offline"),
    );
    sync.queueLocalListMetadataPatch(listId, {
      name: next.name,
      listType: next.listType,
      updatedAt: next.updatedAt,
    });
  };

  // Todo fields from a form, with empty values dropped so they stay unset
  // (unset fields are left out of the sync hash).
  const todoFieldsFromInput = (input: TodoInput) => ({
    name: input.title,
    description: input.description?.trim() || undefined,
    points: input.points !== undefined && input.points > 1 ? input.points : undefined,
    dueDate: input.dueDate,
    assignedTo: input.assignedTo?.trim() || undefined,
    recurrence: input.dueDate !== undefined ? input.recurrence || undefined : undefined,
  });

  const store = create<StoreState>((set, get) => ({
    lists: [],
    items: [],
    isLoaded: false,
    activeListId: undefined,
    backendConnection: backendSharingEnabled ? "unknown" : "offline",
    syncNotice: undefined,
    backendLogs: [],
    backendBusyRequests: 0,
    backendSharingEnabled,
    load: async () => {
      const lists = await db.lists.toArray();
      const sortedLists = lists.sort((a, b) => a.createdAt - b.createdAt);
      const storedSelectedListId = getStoredSelectedListId();
      const initialActiveListId = sortedLists.some((list) => list.id === storedSelectedListId)
        ? storedSelectedListId
        : sortedLists[0]?.id;

      persistSelectedListId(initialActiveListId);

      const metadata: AppMetadata = {
        id: "app",
        deviceId: getOrCreateDeviceId(),
        appVersion: env.appVersion,
        lastOpenedAt: clock(),
      };

      // Boot only loads the active list's items — via the indexed `listId`
      // query — so first paint never waits on a full scan of every item ever
      // created across every list (checked-off items are kept forever for
      // stats, so that history can be arbitrarily large for a long-lived
      // household). The rest of item history hydrates in the background below.
      const [activeListItems] = await Promise.all([
        initialActiveListId
          ? db.items.where("listId").equals(initialActiveListId).toArray()
          : Promise.resolve<Item[]>([]),
        db.metadata.put(metadata),
      ]);

      set({
        lists: sortedLists,
        items: activeListItems,
        activeListId: initialActiveListId,
        metadata,
        isLoaded: true,
      });

      // Hydrate every other list's items in the background after first paint.
      // The websocket sync manager is intentionally not started until this
      // completes: its full sync pass (docs/frontend-sharing-sync.md) walks
      // every known list and reads local items for each one synchronously from
      // the store, so starting it earlier could see a not-yet-hydrated list as
      // having zero local items and let stale server data overwrite genuine
      // offline edits that are already sitting in IndexedDB.
      void db.items.toArray().then((allItems) => {
        store.setState((state) => {
          const knownListIds = new Set(state.lists.map((list) => list.id));
          const existingIds = new Set(state.items.map((item) => item.id));
          const additions = allItems.filter(
            (item) => knownListIds.has(item.listId) && !existingIds.has(item.id),
          );
          return additions.length > 0 ? { items: [...state.items, ...additions] } : {};
        });

        if (backendSharingEnabled) {
          sync.init(metadata.deviceId, createStoreSyncCallbacks({
            db,
            api,
            getLists: () => store.getState().lists,
            getItems: () => store.getState().items,
            getDeviceId: () => store.getState().metadata?.deviceId,
            applyAcceptedItems: (acceptedItems) => {
              store.setState((state) => ({
                items: mergeItemsById(
                  state.items,
                  acceptedItems.filter((incoming) => {
                    const current = findItemById(state.items, incoming.id);
                    return !current || shouldAcceptItem(incoming, current);
                  }),
                ),
              }));
            },
            applyListMetadata: (updatedList) => {
              store.setState((state) => ({
                lists: state.lists.map((entry) =>
                  entry.id === updatedList.id && shouldAcceptListMetadata(updatedList, entry) ? updatedList : entry,
                ),
              }));
            },
            onConnectionState: (connectionState) => {
              store.setState({ backendConnection: connectionState });
            },
            onError: (message) => {
              reportSyncError(`${message} ${t("sync.pending")}`);
            },
          }));
          sync.setActiveList(initialActiveListId);
        }
      }).catch((error: unknown) => {
        // Sync init is gated on hydration, so a failed hydration must be
        // surfaced — otherwise realtime sync silently never starts.
        const details = describeSyncError(error);
        reportSyncError(
          details ? `${t("sync.pending")} (${details})` : t("sync.pending"),
        );
      });
    },
    addList: async (name: string, listType: ListType = defaultListType) => {
      const now = clock();
      const list: List = {
        id: createId(),
        name,
        listType,
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
        () => syncListNameImmediately(list.id, list.name, list.updatedAt, list.listType),
        t("sync.offline"),
      );

      sync.setActiveList(list.id);
    },
    renameList: async (listId: string, name: string) => {
      await updateListMetadata(listId, { name });
    },
    setListType: async (listId: string, listType: ListType) => {
      await updateListMetadata(listId, { listType });
    },
    deleteList: async (listId: string) => {
      await db.transaction("rw", db.items, db.lists, db.listShares, async () => {
        await db.items.where("listId").equals(listId).delete();
        await db.lists.delete(listId);
        await db.listShares.delete(listId);
      });
      set((state) => {
        const remainingLists = state.lists.filter((list) => list.id !== listId);
        const nextActiveListId =
          state.activeListId === listId ? remainingLists[0]?.id : state.activeListId;
        persistSelectedListId(nextActiveListId);
        sync.setActiveList(nextActiveListId);
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
      sync.setActiveList(listId);
    },
    addItem: async (listId: string, name: string, quantityOrUnit?: string) => {
      const now = clock();
      const deviceId = get().metadata?.deviceId;
      const { category: resolvedCategory, iconName: resolvedIcon } = getCategoryAndIcon(name);
      const item: Item = {
        id: createId(),
        listId,
        name,
        quantityOrUnit,
        iconName: resolvedIcon ?? "default",
        category: resolvedCategory ?? "other",
        deleted: false,
        createdByDeviceId: deviceId,
        createdAt: now,
        updatedAt: now,
      };
      await applyLocalItemChanges([item]);
    },
    recategorizeSuggestedItems: async (itemUpdates, locale) => {
      if (itemUpdates.length === 0) {
        return;
      }

      const updatesByItemId = new Map(itemUpdates.map((update) => [update.itemId, update.category]));
      const changedItems = get().items
        .filter((item) => updatesByItemId.has(item.id))
        .map((item) => {
          const nextCategory = updatesByItemId.get(item.id);
          return {
            ...item,
            category: nextCategory ?? item.category,
            iconName: getItemIconName(item.name, locale) ?? item.iconName,
            updatedAt: nextUpdatedAt(item.updatedAt),
          };
        });

      if (changedItems.length === 0) {
        return;
      }

      await applyLocalItemChanges(changedItems);
    },
    toggleItem: async (itemId: string) => {
      const { items } = get();
      const item = findItemById(items, itemId);
      if (!item) {return;}
      const updated = {
        ...item,
        deleted: !item.deleted,
        updatedAt: nextUpdatedAt(item.updatedAt),
      };
      await applyLocalItemChanges([updated]);
    },
    updateItem: async (itemId: string, name: string, quantityOrUnit?: string) => {
      const { items } = get();
      const item = findItemById(items, itemId);
      if (!item) {return;}
      const { category: resolvedCategory, iconName: resolvedIcon } = getCategoryAndIcon(name);
      const updated = {
        ...item,
        name,
        quantityOrUnit,
        iconName: resolvedIcon ?? "default",
        category: resolvedCategory ?? "other",
        updatedAt: nextUpdatedAt(item.updatedAt),
      };
      await applyLocalItemChanges([updated]);
    },
    addTodo: async (listId: string, input: TodoInput) => {
      const now = clock();
      // Todos get an icon/category too, so they look right in the grid if the
      // list is switched to a shopping list.
      const { category: resolvedCategory, iconName: resolvedIcon } = getCategoryAndIcon(input.title);
      const item: Item = {
        id: createId(),
        listId,
        iconName: resolvedIcon ?? "default",
        category: resolvedCategory ?? "other",
        deleted: false,
        createdByDeviceId: get().metadata?.deviceId,
        createdAt: now,
        updatedAt: now,
        ...todoFieldsFromInput(input),
      };
      await applyLocalItemChanges([item]);
    },
    updateTodo: async (itemId: string, input: TodoInput) => {
      const item = findItemById(get().items, itemId);
      if (!item) {return;}
      const renamed = item.name !== input.title;
      const { category: resolvedCategory, iconName: resolvedIcon } = renamed
        ? getCategoryAndIcon(input.title)
        : { category: item.category, iconName: item.iconName };
      const updated: Item = {
        ...item,
        ...todoFieldsFromInput(input),
        iconName: resolvedIcon ?? "default",
        category: resolvedCategory ?? "other",
        updatedAt: nextUpdatedAt(item.updatedAt),
      };
      await applyLocalItemChanges([updated]);
    },
    toggleTodoCompleted: async (itemId: string) => {
      const item = findItemById(get().items, itemId);
      if (!item) {return {};}
      const now = clock();
      const completing = item.completedAt === undefined;
      const updated: Item = {
        ...item,
        completedAt: completing ? now : undefined,
        updatedAt: nextUpdatedAt(item.updatedAt),
      };
      const changed: Item[] = [updated];

      let spawnedItemId: string | undefined;
      if (completing && item.recurrence && item.dueDate !== undefined) {
        const nextDueDate = computeNextDueDate(item.recurrence, item.dueDate, now);
        if (nextDueDate !== null) {
          spawnedItemId = createId();
          changed.push({
            ...item,
            id: spawnedItemId,
            deleted: false,
            completedAt: undefined,
            dueDate: nextDueDate,
            createdByDeviceId: get().metadata?.deviceId,
            createdAt: now,
            updatedAt: now,
          });
        }
      }

      await applyLocalItemChanges(changed);
      return { spawnedItemId };
    },
    undoTodoCompleted: async (itemId: string, spawnedItemId?: string) => {
      const { items } = get();
      const changed: Item[] = [];
      const item = findItemById(items, itemId);
      if (item && item.completedAt !== undefined) {
        changed.push({ ...item, completedAt: undefined, updatedAt: nextUpdatedAt(item.updatedAt) });
      }
      const spawned = spawnedItemId ? findItemById(items, spawnedItemId) : undefined;
      if (spawned && !spawned.deleted) {
        changed.push({ ...spawned, deleted: true, updatedAt: nextUpdatedAt(spawned.updatedAt) });
      }
      if (changed.length > 0) {
        await applyLocalItemChanges(changed);
      }
    },
    ensureShareToken: async (listId: string) => {
      const state = get();
      if (!backendSharingEnabled) {
        throw new Error("Backend sharing is disabled");
      }

      const list = state.lists.find((entry) => entry.id === listId);
      if (!list || !state.metadata?.deviceId) {
        throw new Error("List or device metadata missing");
      }

      await api.upsertList({
        deviceId: state.metadata.deviceId,
        listId: list.id,
        body: { name: list.name, listType: list.listType, updatedAt: new Date(list.updatedAt).toISOString() },
      });

      const tokenResponse = await api.createShareToken({
        deviceId: state.metadata.deviceId,
        listId: list.id,
      });

      markBackendOnline();
      return tokenResponse.shareToken;
    },
    joinSharedList: async (rawShareValue: string) => {
      const state = get();
      if (!backendSharingEnabled) {
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
        const redemption = await api.redeemShareToken({
          deviceId: state.metadata.deviceId,
          shareToken,
        });

        const remoteList = await api.fetchList({
          deviceId: state.metadata.deviceId,
          listId: redemption.listId,
        });

        const localList: List = {
          id: remoteList.listId,
          name: remoteList.name,
          listType: remoteList.listType ?? defaultListType,
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
          createdByDeviceId: item.createdByDeviceId,
          description: item.description,
          points: item.points,
          completedAt: item.completedAt ? toMillis(item.completedAt) : undefined,
          dueDate: item.dueDate ? toMillis(item.dueDate) : undefined,
          assignedTo: item.assignedTo,
          recurrence: item.recurrence,
          createdAt: toMillis(item.createdAt),
          updatedAt: toMillis(item.updatedAt),
        }));

        const syncedAt = clock();
        await db.transaction("rw", db.lists, db.items, db.listShares, async () => {
          await db.lists.put(localList);
          await db.items.bulkPut(localItems);
          await db.listShares.put({
            listId: localList.id,
            lastSyncedAt: syncedAt,
          });
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
        sync.setActiveList(localList.id);
        return localList.id;
      } catch (error) {
        const details = describeSyncError(error);
        reportSyncError(
          details
            ? t("sync.joinFailedWithDetails", { details })
            : t("sync.joinFailed"),
        );
        throw error;
      }
    },
    syncAllLists: async () => {
      if (!backendSharingEnabled) {
        return;
      }

      sync.requestResync();
    },
    refreshRealtimeConnection: async () => {
      if (!backendSharingEnabled) {
        return "failed";
      }

      return sync.forceReconnect();
    },
    clearSyncNotice: () => set({ syncNotice: undefined }),
    appendBackendLog: (entry) =>
      set((state) => ({
        backendLogs: [
          ...state.backendLogs.slice(-49),
          { id: createId(), message: entry.message, outcome: entry.outcome },
        ],
      })),
  }));

  env.setBackendCallLogger((entry) => {
    store.getState().appendBackendLog({
      message: `${entry.endpoint}: ${entry.message}`,
      outcome: entry.outcome,
    });
  });

  env.setActiveBackendRequestLogger((count) => {
    store.setState({ backendBusyRequests: count });
  });

  return store;
};

// Read lazily so tests can stub `localStorage` after importing this module.
const browserStorage: KeyValueStorage = {
  getItem: (key) => localStorage.getItem(key),
  setItem: (key, value) => localStorage.setItem(key, value),
  removeItem: (key) => localStorage.removeItem(key),
};

export const useStore = createGoListStore({
  db: defaultDb,
  api: sharingApiClient,
  isBackendSharingEnabled,
  setBackendCallLogger,
  setActiveBackendRequestLogger,
  sync: socketSyncManager,
  storage: browserStorage,
  now: () => Date.now(),
  createId: () => crypto.randomUUID(),
  appVersion: __APP_VERSION__,
});

export type GoListStore = typeof useStore;
