import type { Item } from "@golist/shared/domain/types";

export type ListStatsTopItem = {
  name: string;
  count: number;
  averageFrequencyMs?: number;
};

export type ListStats = {
  totalItemsEver: number;
  openItems: number;
  topItems: ListStatsTopItem[];
  lastBoughtAt?: number;
};

export const QUICK_TOGGLE_WINDOW_MS = 30_000;

export const calculateListStats = (items: Item[], listId?: string): ListStats => {
  const activeListHistory = items.filter((item) => item.listId === listId);

  const statsHistory = activeListHistory.filter((item) => {
    const wasToggled = item.updatedAt !== item.createdAt;
    if (!wasToggled) {
      return true;
    }

    return item.updatedAt - item.createdAt > QUICK_TOGGLE_WINDOW_MS;
  });

  const counts = new Map<string, number>();
  const createdAtByName = new Map<string, number[]>();
  const displayNameByKey = new Map<string, string>();

  statsHistory.forEach((item) => {
    const trimmedName = item.name.trim();
    const normalizedName = trimmedName.toLocaleLowerCase();
    if (!normalizedName) {
      return;
    }

    if (!displayNameByKey.has(normalizedName)) {
      displayNameByKey.set(normalizedName, trimmedName);
    }

    counts.set(normalizedName, (counts.get(normalizedName) ?? 0) + 1);
    const createdAtEntries = createdAtByName.get(normalizedName) ?? [];
    createdAtEntries.push(item.createdAt);
    createdAtByName.set(normalizedName, createdAtEntries);
  });

  const topItems = Array.from(counts.entries())
    .map(([normalizedName, count]) => {
      const timestamps = (createdAtByName.get(normalizedName) ?? []).sort((a, b) => a - b);
      const intervals = timestamps.slice(1).map((timestamp, index) => timestamp - timestamps[index]);
      const averageFrequencyMs = intervals.length > 0
        ? Math.round(intervals.reduce((sum, interval) => sum + interval, 0) / intervals.length)
        : undefined;
      const displayName = displayNameByKey.get(normalizedName) ?? normalizedName;

      return { name: displayName, count, averageFrequencyMs };
    })
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name))
    .slice(0, 5);

  const lastBoughtAt = statsHistory
    .filter((item) => item.deleted)
    .reduce<number | undefined>((latest, item) => {
      if (!latest || item.updatedAt > latest) {
        return item.updatedAt;
      }
      return latest;
    }, undefined);

  return {
    totalItemsEver: statsHistory.length,
    openItems: statsHistory.filter((item) => !item.deleted).length,
    topItems,
    lastBoughtAt,
  };
};
