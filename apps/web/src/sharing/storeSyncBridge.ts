import type { Item, List } from "@golist/shared/domain/types";
import { shouldAcceptItem, shouldAcceptListMetadata } from "@golist/shared/domain/sync";
import { db as defaultDb, type GoListDatabase } from "../storage/db";
import { sharingApiClient, type SharingApiClient } from "./apiClient";
import type { SocketSyncCallbacks } from "./socketSync";

// State access is injected so this module has no runtime dependency on the
// store — it owns conflict resolution and Dexie persistence for incoming
// websocket data, while the store applies the resulting state changes.
type StoreSyncBridgeDeps = {
  getLists: () => List[];
  getItems: () => Item[];
  getDeviceId: () => string | undefined;
  // State-only updates; the bridge has already persisted to Dexie.
  // Both must still ignore records whose in-memory version is newer (a local
  // edit can land while the incoming change is being persisted).
  applyAcceptedItems: (acceptedItems: Item[]) => void;
  applyListMetadata: (updatedList: List) => void;
  onConnectionState: (state: "online" | "offline") => void;
  onError: (message: string) => void;
  // Default to the app singletons; the sync simulation passes per-device ones.
  db?: Pick<GoListDatabase, "items" | "lists" | "transaction">;
  api?: Pick<SharingApiClient, "upsertList">;
};

export const createStoreSyncCallbacks = (deps: StoreSyncBridgeDeps): SocketSyncCallbacks => {
  const db = deps.db ?? defaultDb;
  const api = deps.api ?? sharingApiClient;
  return {
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
        await api.upsertList({
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

      const candidates = incomingItems.filter((incoming) => {
        if (incoming.listId !== listId) {
          return false;
        }
        const localItem = localById.get(incoming.id);
        return !localItem || shouldAcceptItem(incoming, localItem);
      });

      if (candidates.length === 0) {
        return;
      }

      // Re-check against the stored records inside the write transaction: a
      // local edit can be persisted between the in-memory check above and
      // this write, and must not be overwritten by an older incoming version
      // (found by the sync fuzzer; see sim/scenarios/races.sim.test.ts).
      const acceptedItems = await db.transaction("rw", db.items, async () => {
        const stored = await db.items.bulkGet(candidates.map((item) => item.id));
        const winners = candidates
          .map((incoming, index) => ({ incoming, current: stored[index] }))
          .filter(({ incoming, current }) => !current || shouldAcceptItem(incoming, current))
          // The backend does not echo `createdByDeviceId`; keep the locally
          // known creator so per-device features (language suggestion) keep
          // working for items this device created.
          .map(({ incoming, current }) => {
            const createdByDeviceId =
              incoming.createdByDeviceId ?? current?.createdByDeviceId ?? localById.get(incoming.id)?.createdByDeviceId;
            return createdByDeviceId ? { ...incoming, createdByDeviceId } : incoming;
          });
        if (winners.length > 0) {
          await db.items.bulkPut(winners);
        }
        return winners;
      });

      if (acceptedItems.length > 0) {
        deps.applyAcceptedItems(acceptedItems);
      }
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

      // Re-check against the stored record inside the write transaction: a
      // local rename can be persisted between the in-memory check above and
      // this write, and must not be overwritten by the older incoming name.
      // (Found by the sync fuzzer; see sim/scenarios/races.sim.test.ts.)
      const updatedList = await db.transaction("rw", db.lists, async () => {
        const stored = await db.lists.get(listId);
        if (!stored || !shouldAcceptListMetadata(payload, stored)) {
          return null;
        }
        const next = { ...stored, name: payload.name, updatedAt: payload.updatedAt };
        await db.lists.put(next);
        return next;
      });

      if (updatedList) {
        deps.applyListMetadata(updatedList);
      }
    },
    onConnectionState: deps.onConnectionState,
    onError: deps.onError,
  };
};
