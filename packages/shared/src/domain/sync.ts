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
