import type { Item, List } from "@golist/shared/domain/types";
import { buildItemHash, shouldAcceptListMetadata } from "@golist/shared/domain/sync";
import { db } from "../storage/db";
import { sharingApiClient } from "./apiClient";
import type { SocketSyncCallbacks } from "./socketSync";

// State access is injected so this module has no runtime dependency on the
// store — it owns conflict resolution and Dexie persistence for incoming
// websocket data, while the store applies the resulting state changes.
type StoreSyncBridgeDeps = {
  getLists: () => List[];
  getItems: () => Item[];
  getDeviceId: () => string | undefined;
  // State-only updates; the bridge has already persisted to Dexie.
  applyAcceptedItems: (acceptedItems: Item[]) => void;
  applyListMetadata: (updatedList: List) => void;
  onConnectionState: (state: "online" | "offline") => void;
  onError: (message: string) => void;
};

export const createStoreSyncCallbacks = (deps: StoreSyncBridgeDeps): SocketSyncCallbacks => ({
  getItemsForList: (listId) => deps.getItems().filter((item) => item.listId === listId),
  getAllListIds: () => deps.getLists().map((list) => list.id),
  getListMetadata: (listId) => {
    const list = deps.getLists().find((entry) => entry.id === listId);
    return list ? { name: list.name, updatedAt: list.updatedAt } : null;
  },
  ensureListExists: async (listId) => {
    const list = deps.getLists().find((entry) => entry.id === listId);
    const deviceId = deps.getDeviceId();
    if (!list || !deviceId) {
      return false;
    }

    try {
      await sharingApiClient.upsertList({
        deviceId,
        listId: list.id,
        body: { name: list.name, updatedAt: new Date(list.updatedAt).toISOString() },
      });
      return true;
    } catch {
      return false;
    }
  },
  applyIncomingItems: async (listId, incomingItems) => {
    if (!deps.getLists().some((list) => list.id === listId)) {
      return;
    }
    const localById = new Map(
      deps.getItems().filter((item) => item.listId === listId).map((item) => [item.id, item]),
    );

    const acceptedItems = incomingItems.filter((incoming) => {
      if (incoming.listId !== listId) {
        return false;
      }
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
    deps.applyAcceptedItems(acceptedItems);
  },
  applyIncomingListMetadata: async (listId, payload) => {
    const currentList = deps.getLists().find((entry) => entry.id === listId);
    if (!currentList) {
      return;
    }

    // Deterministic tie-break shared with the backend (postgres + in-memory
    // list repositories): on an equal `updatedAt`, the lexicographically
    // greater name wins on every peer so renames converge regardless of
    // arrival order (see `shouldAcceptListMetadata`).
    if (!shouldAcceptListMetadata(payload, currentList)) {
      return;
    }

    const updatedList = {
      ...currentList,
      name: payload.name,
      updatedAt: payload.updatedAt,
    };

    await db.lists.put(updatedList);
    deps.applyListMetadata(updatedList);
  },
  onConnectionState: deps.onConnectionState,
  onError: deps.onError,
});
