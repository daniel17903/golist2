import { describe, expect, it } from "vitest";
import { buildItemHash, shouldAcceptListMetadata, type SyncItemSnapshot } from "@golist/shared/domain/sync";

const shoppingItem: SyncItemSnapshot = {
  id: "11111111-1111-4111-8111-111111111111",
  listId: "22222222-2222-4222-8222-222222222222",
  name: "milk",
  iconName: "milk",
  quantityOrUnit: "1L",
  category: "dairy",
  deleted: false,
  updatedAt: 1700000000000,
};

describe("item hash with todo fields", () => {
  it("hashes items without todo fields exactly as before todo lists existed", () => {
    // Computed with the pre-todo `buildItemHash`. Stored items, older clients
    // and the server must keep agreeing on every existing item's hash.
    expect(buildItemHash(shoppingItem)).toBe("11dcabba");
  });

  it("changes the hash when any todo field is set or changed", () => {
    const base = buildItemHash(shoppingItem);
    const variants: Array<Partial<SyncItemSnapshot>> = [
      { description: "x" },
      { points: 2 },
      { completedAt: 1 },
      { dueDate: 1 },
      { assignedTo: "Alex" },
      { recurrence: "{}" },
    ];
    const hashes = variants.map((variant) => buildItemHash({ ...shoppingItem, ...variant }));
    expect(new Set([base, ...hashes]).size).toBe(variants.length + 1);
    expect(buildItemHash({ ...shoppingItem, points: 3 })).not.toBe(buildItemHash({ ...shoppingItem, points: 2 }));
  });
});

describe("list metadata conflict rule with list types", () => {
  it("breaks equal-timestamp, equal-name ties by list type, treating a missing type as shopping", () => {
    const shopping = { name: "Home", listType: "shopping" as const, updatedAt: 5 };
    const todo = { name: "Home", listType: "todo" as const, updatedAt: 5 };
    expect(shouldAcceptListMetadata(todo, shopping)).toBe(true);
    expect(shouldAcceptListMetadata(shopping, todo)).toBe(false);
    expect(shouldAcceptListMetadata({ name: "Home", updatedAt: 5 }, todo)).toBe(false);
    expect(shouldAcceptListMetadata({ name: "Home", updatedAt: 5 }, shopping)).toBe(false);
    // Newer still wins regardless of type, and the name still decides first.
    expect(shouldAcceptListMetadata({ ...shopping, updatedAt: 6 }, todo)).toBe(true);
    expect(shouldAcceptListMetadata({ name: "Work", listType: "shopping", updatedAt: 5 }, todo)).toBe(true);
  });
});
