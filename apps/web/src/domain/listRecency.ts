import type { List } from "@golist/shared/domain/types";

/** When this device last opened each list (epoch millis), keyed by list id. */
export type ListLastUsedAt = Record<string, number>;

/**
 * Most recently used list first. A list this device never opened counts as
 * used when it was created, so a brand-new list starts at the top.
 */
export const sortListsByLastUsed = (lists: readonly List[], lastUsedAt: ListLastUsedAt): List[] =>
  [...lists].sort((a, b) => (lastUsedAt[b.id] ?? b.createdAt) - (lastUsedAt[a.id] ?? a.createdAt));

/** Reads a stored `ListLastUsedAt` map, dropping anything malformed. */
export const parseListLastUsedAt = (raw: string | null): ListLastUsedAt => {
  if (!raw) {
    return {};
  }
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return {};
    }
    const result: ListLastUsedAt = {};
    for (const [listId, value] of Object.entries(parsed)) {
      if (typeof value === "number" && Number.isFinite(value)) {
        result[listId] = value;
      }
    }
    return result;
  } catch {
    return {};
  }
};
