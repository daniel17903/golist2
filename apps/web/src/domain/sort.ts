import { categories } from "./categories";
import type { Item } from "@golist/shared/domain/types";

const categoryOrderMap = new Map(categories.map((category) => [category.id, category.order]));

export const sortItemsForList = (items: Item[]): Item[] => {
  return [...items].sort((a, b) => {
    const orderA = categoryOrderMap.get(a.category) ?? Number.POSITIVE_INFINITY;
    const orderB = categoryOrderMap.get(b.category) ?? Number.POSITIVE_INFINITY;

    if (orderA !== orderB) {
      return orderA - orderB;
    }

    return a.createdAt - b.createdAt;
  });
};
