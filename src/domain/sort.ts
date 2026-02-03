import { getCategoryOrder } from "./categories";
import type { Item } from "./types";

export const sortItemsForList = (items: Item[]): Item[] => {
  return [...items].sort((a, b) => {
    const orderA = getCategoryOrder(a.name) ?? Number.POSITIVE_INFINITY;
    const orderB = getCategoryOrder(b.name) ?? Number.POSITIVE_INFINITY;

    if (orderA !== orderB) {
      return orderA - orderB;
    }

    return a.createdAt - b.createdAt;
  });
};
