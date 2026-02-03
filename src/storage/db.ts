import Dexie, { type Table } from "dexie";
import type { Item, List } from "../domain/types";

export class GoListDatabase extends Dexie {
  lists!: Table<List, string>;
  items!: Table<Item, string>;

  constructor() {
    super("golist");
    this.version(1).stores({
      lists: "id, name, updatedAt",
      items: "id, listId, checked, updatedAt"
    });
  }
}

export const db = new GoListDatabase();
