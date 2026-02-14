import { describe, expect, it } from "vitest";
import { sortItemsForList } from "./sort";
import type { Item } from "@golist/shared/domain/types";

describe("sortItemsForList", () => {
  it("sorts by category order then createdAt", () => {
    const items: Item[] = [
      {
        id: "1",
        listId: "list",
        name: "unknown",
        checked: false,
        createdAt: 2,
        updatedAt: 2,
      },
      {
        id: "2",
        listId: "list",
        name: "bread",
        checked: false,
        createdAt: 5,
        updatedAt: 5,
      },
      {
        id: "3",
        listId: "list",
        name: "apple",
        checked: false,
        createdAt: 1,
        updatedAt: 1,
      },
      {
        id: "4",
        listId: "list",
        name: "apple",
        checked: false,
        createdAt: 10,
        updatedAt: 10,
      },
    ];

    const sorted = sortItemsForList(items);

    expect(sorted.map((item) => item.id)).toEqual(["3", "4", "2", "1"]);
  });
});
