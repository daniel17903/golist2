import Dexie, { type DexieOptions, type Table } from "dexie";
import type { AppMetadata, Item, List } from "@golist/shared/domain/types";

export type ListShare = {
  listId: string;
  lastSyncedAt: number;
};

export class GoListDatabase extends Dexie {
  lists!: Table<List, string>;
  items!: Table<Item, string>;
  metadata!: Table<AppMetadata, string>;
  listShares!: Table<ListShare, string>;

  // The sync simulation (apps/web/sim) gives every virtual device its own
  // database name and IndexedDB factory.
  constructor(name = "golist", options?: DexieOptions) {
    super(name, options);
    this.version(1).stores({
      lists: "id, name, updatedAt",
      items: "id, listId, deleted, updatedAt",
    });
    this.version(2).stores({
      lists: "id, name, updatedAt",
      items: "id, listId, deleted, updatedAt",
      metadata: "id",
    });
    this.version(3).stores({
      lists: "id, name, updatedAt",
      items: "id, listId, deleted, updatedAt",
      metadata: "id",
      listShares: "listId, shareToken, lastSyncedAt",
    });
    this.version(4).stores({
      lists: "id, name, updatedAt",
      items: "id, listId, deleted, updatedAt",
      metadata: "id",
      listShares: "listId, lastSyncedAt",
    });
  }
}

export const db = new GoListDatabase();
