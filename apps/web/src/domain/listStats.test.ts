import { describe, expect, it } from "vitest";
import type { Item } from "@golist/shared/domain/types";
import { calculateListStats } from "./listStats";

const createItem = (overrides: Partial<Item> & Pick<Item, "id" | "listId" | "name">): Item => ({
  id: overrides.id,
  listId: overrides.listId,
  name: overrides.name,
  iconName: overrides.iconName ?? "default",
  category: overrides.category ?? "other",
  deleted: overrides.deleted ?? false,
  createdAt: overrides.createdAt ?? 0,
  updatedAt: overrides.updatedAt ?? overrides.createdAt ?? 0,
  quantityOrUnit: overrides.quantityOrUnit,
});

describe("calculateListStats", () => {
  it("returns per-list stats", () => {
    const items: Item[] = [
      createItem({ id: "1", listId: "a", name: "Milk", createdAt: 1000, updatedAt: 1000 }),
      createItem({ id: "2", listId: "a", name: "Bread", createdAt: 2000, updatedAt: 2000 }),
      createItem({ id: "3", listId: "b", name: "Milk", createdAt: 3000, updatedAt: 3000 }),
    ];

    const stats = calculateListStats(items, "a");

    expect(stats.totalItemsEver).toBe(2);
    expect(stats.openItems).toBe(2);
    expect(stats.topItems).toHaveLength(2);
  });

  it("groups top items case-insensitively and computes average frequency", () => {
    const items: Item[] = [
      createItem({ id: "1", listId: "a", name: "Milk", createdAt: 1000, updatedAt: 1000 }),
      createItem({ id: "2", listId: "a", name: "milk", createdAt: 4000, updatedAt: 4000 }),
      createItem({ id: "3", listId: "a", name: "MILK", createdAt: 7000, updatedAt: 7000 }),
    ];

    const stats = calculateListStats(items, "a");

    expect(stats.topItems).toEqual([
      {
        name: "Milk",
        count: 3,
        averageFrequencyMs: 3000,
      },
    ]);
  });

  it("ignores quick toggles in stats and keeps last bought timestamp", () => {
    const items: Item[] = [
      createItem({ id: "1", listId: "a", name: "Eggs", createdAt: 1000, updatedAt: 20_000, deleted: true }),
      createItem({ id: "2", listId: "a", name: "Eggs", createdAt: 30_000, updatedAt: 80_000, deleted: true }),
    ];

    const stats = calculateListStats(items, "a");

    expect(stats.totalItemsEver).toBe(1);
    expect(stats.openItems).toBe(0);
    expect(stats.lastBoughtAt).toBe(80_000);
    expect(stats.topItems[0]).toMatchObject({ count: 1 });
  });
});
