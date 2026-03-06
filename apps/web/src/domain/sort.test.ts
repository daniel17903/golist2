import { describe, expect, it } from "vitest";
import { sortItemsForList } from "./sort";
import type { Item } from "@golist/shared/domain/types";

describe("sortItemsForList", () => {
  it("sorts by category order then alphabetically then createdAt", () => {
    const items: Item[] = [
      {
        id: "1",
        listId: "list",
        name: "unknown",
        iconName: "default",
        category: "other",
        deleted: false,
        createdAt: 2,
        updatedAt: 2,
      },
      {
        id: "2",
        listId: "list",
        name: "bread",
        iconName: "bread",
        category: "bread",
        deleted: false,
        createdAt: 5,
        updatedAt: 5,
      },
      {
        id: "3",
        listId: "list",
        name: "apple",
        iconName: "apple",
        category: "fruitsVegetables",
        deleted: false,
        createdAt: 1,
        updatedAt: 1,
      },
      {
        id: "4",
        listId: "list",
        name: "banana",
        iconName: "banana",
        category: "fruitsVegetables",
        deleted: false,
        createdAt: 10,
        updatedAt: 10,
      },
    ];

    const sorted = sortItemsForList(items);

    expect(sorted.map((item) => item.id)).toEqual(["3", "4", "2", "1"]);
  });

  it("falls back to createdAt when names match ignoring case", () => {
    const items: Item[] = [
      {
        id: "a",
        listId: "list",
        name: "Milk",
        iconName: "milk",
        category: "milkCheese",
        deleted: false,
        createdAt: 20,
        updatedAt: 20,
      },
      {
        id: "b",
        listId: "list",
        name: "milk",
        iconName: "milk",
        category: "milkCheese",
        deleted: false,
        createdAt: 10,
        updatedAt: 10,
      },
    ];

    const sorted = sortItemsForList(items);

    expect(sorted.map((item) => item.id)).toEqual(["b", "a"]);
  });
});
