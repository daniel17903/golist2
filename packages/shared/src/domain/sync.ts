import type { Item } from './types';

export type SyncItemSnapshot = Pick<Item, 'id' | 'listId' | 'name' | 'iconName' | 'quantityOrUnit' | 'category' | 'deleted' | 'updatedAt'>;

const stableSerializeItem = (item: SyncItemSnapshot): string =>
  JSON.stringify({
    id: item.id,
    listId: item.listId,
    name: item.name,
    iconName: item.iconName,
    quantityOrUnit: item.quantityOrUnit ?? null,
    category: item.category,
    deleted: item.deleted,
    updatedAt: item.updatedAt,
  });

const stringHash = (value: string): string => {
  let hash = 5381;
  for (let index = 0; index < value.length; index += 1) {
    hash = ((hash << 5) + hash) ^ value.charCodeAt(index);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
};

export const buildItemHash = (item: SyncItemSnapshot): string => stringHash(stableSerializeItem(item));

export const buildListDigest = (items: readonly SyncItemSnapshot[]): string => {
  const normalized = items
    .map((item) => ({ id: item.id, hash: buildItemHash(item) }))
    .sort((left, right) => left.id.localeCompare(right.id));

  return stringHash(JSON.stringify(normalized));
};

export type SyncItemSummary = {
  itemId: string;
  updatedAt: number;
  itemHash: string;
};

export const buildItemSummaries = (items: readonly SyncItemSnapshot[]): SyncItemSummary[] =>
  items
    .map((item) => ({
      itemId: item.id,
      updatedAt: item.updatedAt,
      itemHash: buildItemHash(item),
    }))
    .sort((left, right) => left.itemId.localeCompare(right.itemId));

export type ListMetadataSnapshot = {
  name: string;
  updatedAt: number;
};

/**
 * Deterministic conflict rule for list-metadata (rename) sync, shared by the
 * client (`storeSyncBridge.ts`) and both backend list repositories so they
 * never disagree.
 *
 * Mirrors the item-sync tie-break style (last-write-wins by `updatedAt`,
 * falling back to a deterministic comparison when timestamps tie): when two
 * offline devices rename the same list within the same millisecond, the
 * lexicographically greater name wins on every peer, so all devices converge
 * on one final name regardless of message arrival order.
 */
export const shouldAcceptListMetadata = (
  incoming: ListMetadataSnapshot,
  current: ListMetadataSnapshot,
): boolean => {
  if (incoming.updatedAt > current.updatedAt) {
    return true;
  }
  if (incoming.updatedAt < current.updatedAt) {
    return false;
  }
  return incoming.name > current.name;
};
