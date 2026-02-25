export type ListRecord = {
  id: string
  name: string
  createdAt: string
  updatedAt: string
}

export type ListItemRecord = {
  id: string
  listId: string
  name: string
  iconName: string
  quantityOrUnit?: string
  category: string
  deleted: boolean
  createdAt: string
  updatedAt: string
}

export type ItemUpsertInput = {
  name: string
  iconName: string
  quantityOrUnit?: string
  category: string
  deleted: boolean
  updatedAt: string
}

export type PutListResult =
  | { outcome: 'created' }
  | { outcome: 'updated' }
  | { outcome: 'forbidden' }

export type UpsertListItemResult =
  | { outcome: 'created' }
  | { outcome: 'updated' }
  | { outcome: 'conflict' }

export interface ListRepository {
  ping(): Promise<void>
  hasListAccess(listId: string, deviceId: string): Promise<boolean>
  findValidShareToken(shareToken: string): Promise<{ tokenId: string; listId: string } | null>
  putList(listId: string, name: string, deviceId: string): Promise<PutListResult>
  getList(listId: string): Promise<ListRecord | null>
  deleteList(listId: string, deviceId: string): Promise<boolean>
  listItems(listId: string): Promise<ListItemRecord[]>
  listItemsUpdatedAfter(listId: string, updatedAfter: string): Promise<ListItemRecord[]>
  getListItem(listId: string, itemId: string): Promise<ListItemRecord | null>
  upsertListItem(listId: string, itemId: string, deviceId: string, input: ItemUpsertInput): Promise<UpsertListItemResult>
  createShareToken(listId: string, deviceId: string): Promise<{ tokenId: string; createdAt: string }>
  recordShareTokenRedemption(tokenId: string, deviceId: string): Promise<void>
}
