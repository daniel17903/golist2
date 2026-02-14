import Dexie, { type Table } from "dexie";
import type { AppMetadata, Item, List } from "@golist/shared/domain/types";

export class GoListDatabase extends Dexie {
  lists!: Table<List, string>;
  items!: Table<Item, string>;
  metadata!: Table<AppMetadata, string>;

  constructor() {
    super("golist");
    this.version(1).stores({
      lists: "id, name, updatedAt",
      items: "id, listId, checked, updatedAt",
    });
    this.version(2).stores({
      lists: "id, name, updatedAt",
      items: "id, listId, checked, updatedAt",
      metadata: "id",
    });
  }
}

export const db = new GoListDatabase();
