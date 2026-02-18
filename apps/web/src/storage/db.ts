import Dexie, { type Table } from "dexie";
import type { AppMetadata, Item, List } from "@golist/shared/domain/types";

export type ListShare = {
  listId: string;
  shareToken: string;
  lastSyncedAt: number;
};

export class GoListDatabase extends Dexie {
  lists!: Table<List, string>;
  items!: Table<Item, string>;
  metadata!: Table<AppMetadata, string>;
  listShares!: Table<ListShare, string>;

  constructor() {
    super("golist");
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
  }
}

export const db = new GoListDatabase();
