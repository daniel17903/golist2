import { defaultListType, type Item, type ListType } from './types';

export type SyncItemSnapshot = Pick<
  Item,
  | 'id'
  | 'listId'
  | 'name'
  | 'iconName'
  | 'quantityOrUnit'
  | 'category'
  | 'deleted'
  | 'updatedAt'
  | 'description'
  | 'points'
  | 'completedAt'
  | 'dueDate'
  | 'assignedTo'
  | 'recurrence'
>;

/**
 * Todo fields are appended only when set, in a fixed order. A shopping item
 * (no todo fields) therefore serializes exactly as it did before todo lists
 * existed, so stored items, older clients and the server keep agreeing on
 * every existing item hash.
 */
const TODO_HASH_FIELDS = ['description', 'points', 'completedAt', 'dueDate', 'assignedTo', 'recurrence'] as const;

const stableSerializeItem = (item: SyncItemSnapshot): string => {
  const serialized: Record<string, unknown> = {
    id: item.id,
    listId: item.listId,
    name: item.name,
    iconName: item.iconName,
    quantityOrUnit: item.quantityOrUnit ?? null,
    category: item.category,
    deleted: item.deleted,
    updatedAt: item.updatedAt,
  };
  for (const field of TODO_HASH_FIELDS) {
    const value = item[field];
    if (value !== undefined && value !== null) {
      serialized[field] = value;
    }
  }
  return JSON.stringify(serialized);
};

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

/**
 * Last-write-wins rule for items as applied by the web client: the newer
 * `updatedAt` wins; on a tie the greater item hash wins, so every peer picks
 * the same version regardless of arrival order. Both backend list
 * repositories implement the same comparison (with a strict `>` on the hash,
 * so re-sending an identical version is reported as `ignored`); keep them in
 * sync. An identical version (same hash) is accepted here, which keeps
 * re-applying it idempotent.
 */
export const shouldAcceptItem = (incoming: SyncItemSnapshot, current: SyncItemSnapshot): boolean => {
  if (incoming.updatedAt !== current.updatedAt) {
    return incoming.updatedAt > current.updatedAt;
  }
  return buildItemHash(incoming) >= buildItemHash(current);
};

export type ListMetadataSnapshot = {
  name: string;
  /** Unset means `shopping` (lists from before list types existed). */
  listType?: ListType;
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
 * on one final name regardless of message arrival order. When the names are
 * equal too, the greater list type wins (`todo` over `shopping`).
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
  if (incoming.name !== current.name) {
    return incoming.name > current.name;
  }
  return (incoming.listType ?? defaultListType) > (current.listType ?? defaultListType);
};
