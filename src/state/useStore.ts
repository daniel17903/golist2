import { create } from "zustand";
import type { AppMetadata, Item, List } from "../domain/types";
import { db } from "../storage/db";

const createId = () => crypto.randomUUID();
const appVersion = __APP_VERSION__;

type StoreState = {
  lists: List[];
  items: Item[];
  metadata?: AppMetadata;
  activeListId?: string;
  isLoaded: boolean;
  load: () => Promise<void>;
  addList: (name: string) => Promise<void>;
  renameList: (listId: string, name: string) => Promise<void>;
  setActiveList: (listId: string) => void;
  addItem: (listId: string, name: string, quantityOrUnit?: string) => Promise<void>;
  toggleItem: (itemId: string) => Promise<void>;
  updateItem: (itemId: string, name: string, quantityOrUnit?: string) => Promise<void>;
};

export const useStore = create<StoreState>((set, get) => ({
  lists: [],
  items: [],
  isLoaded: false,
  activeListId: undefined,
  load: async () => {
    const [lists, items] = await Promise.all([db.lists.toArray(), db.items.toArray()]);
    const sortedLists = lists.sort((a, b) => a.createdAt - b.createdAt);
    const metadata: AppMetadata = {
      id: "app",
      appVersion,
      lastOpenedAt: Date.now()
    };
    await db.metadata.put(metadata);
    set({
      lists: sortedLists,
      items,
      activeListId: sortedLists[0]?.id,
      metadata,
      isLoaded: true
    });
  },
  addList: async (name: string) => {
    const now = Date.now();
    const list: List = {
      id: createId(),
      name,
      createdAt: now,
      updatedAt: now
    };
    await db.lists.add(list);
    set((state) => ({
      lists: [...state.lists, list],
      activeListId: list.id
    }));
  },
  renameList: async (listId: string, name: string) => {
    const now = Date.now();
    await db.lists.update(listId, { name, updatedAt: now });
    set((state) => ({
      lists: state.lists.map((list) =>
        list.id === listId ? { ...list, name, updatedAt: now } : list
      )
    }));
  },
  setActiveList: (listId: string) => set({ activeListId: listId }),
  addItem: async (listId: string, name: string, quantityOrUnit?: string) => {
    const now = Date.now();
    const item: Item = {
      id: createId(),
      listId,
      name,
      quantityOrUnit,
      checked: false,
      createdAt: now,
      updatedAt: now
    };
    await db.items.add(item);
    set((state) => ({ items: [...state.items, item] }));
  },
  toggleItem: async (itemId: string) => {
    const { items } = get();
    const item = items.find((entry) => entry.id === itemId);
    if (!item) return;
    const updated = { ...item, checked: !item.checked, updatedAt: Date.now() };
    await db.items.put(updated);
    set((state) => ({
      items: state.items.map((entry) => (entry.id === itemId ? updated : entry))
    }));
  },
  updateItem: async (itemId: string, name: string, quantityOrUnit?: string) => {
    const { items } = get();
    const item = items.find((entry) => entry.id === itemId);
    if (!item) return;
    const updated = {
      ...item,
      name,
      quantityOrUnit,
      updatedAt: Date.now()
    };
    await db.items.put(updated);
    set((state) => ({
      items: state.items.map((entry) => (entry.id === itemId ? updated : entry))
    }));
  }
}));
