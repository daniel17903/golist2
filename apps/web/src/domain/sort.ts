import { categoryOrderById } from "./categories";
import type { Item } from "@golist/shared/domain/types";

export const sortItemsForList = (items: Item[]): Item[] => {
  return [...items].sort((a, b) => {
    const orderA = categoryOrderById[a.category] ?? Number.POSITIVE_INFINITY;
    const orderB = categoryOrderById[b.category] ?? Number.POSITIVE_INFINITY;

    if (orderA !== orderB) {
      return orderA - orderB;
    }

    const nameOrder = a.name.localeCompare(b.name, undefined, { sensitivity: "base" });

    if (nameOrder !== 0) {
      return nameOrder;
    }

    return a.createdAt - b.createdAt;
  });
};
