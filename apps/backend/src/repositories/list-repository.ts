import type { ListType, TodoFields } from '@golist/shared/domain/types'

export type ListRecord = {
  id: string
  name: string
  listType: ListType
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
} & TodoFields<string>

export type ItemUpsertInput = {
  name: string
  iconName: string
  quantityOrUnit?: string
  category: string
  deleted: boolean
  updatedAt: string
} & TodoFields<string>

export type ItemBatchUpsertEntry = {
  itemId: string
  input: ItemUpsertInput
}

export type PutListResult =
  | { outcome: 'created' }
  | { outcome: 'updated' }
  | { outcome: 'ignored' }
  | { outcome: 'forbidden' }

export type UpsertListItemResult =
  | { outcome: 'created' }
  | { outcome: 'updated' }
  | { outcome: 'ignored' }
  | { outcome: 'conflict' }

/** An AI assistant connection (MCP connector); see `006_add_mcp_connectors.sql`. */
export type ConnectorRecord = {
  id: string
  label: string
  /** The connector's own device id (never shown to the owner or the assistant). */
  deviceId: string
  ownerDeviceId: string
  includeAllLists: boolean
  /** The lists picked when `includeAllLists` is false (sorted). */
  listIds: string[]
  createdAt: string
  lastUsedAt?: string
}

export type ConnectorInput = {
  label: string
  includeAllLists: boolean
  listIds: string[]
}

export interface ListRepository {
  ping(): Promise<void>
  /**
   * Whether the device may read and write the list: it created the list, or
   * redeemed a valid share token for it — or it is a connector whose owner
   * device may access the list and that connector includes the list.
   */
  hasListAccess(listId: string, deviceId: string): Promise<boolean>
  /** Every list `hasListAccess` allows for the device, ordered by id. */
  listAccessibleLists(deviceId: string): Promise<ListRecord[]>
  findValidShareToken(shareToken: string): Promise<{ tokenId: string; listId: string } | null>
  /**
   * Creates or renames a list. `listType` unset keeps the stored type (or
   * creates a `shopping` list), so clients and API callers that predate list
   * types never reset it.
   */
  putList(listId: string, name: string, deviceId: string, updatedAt?: string, listType?: ListType): Promise<PutListResult>
  getList(listId: string): Promise<ListRecord | null>
  deleteList(listId: string, deviceId: string): Promise<boolean>
  listItems(listId: string): Promise<ListItemRecord[]>
  listItemsUpdatedAfter(listId: string, updatedAfter: string): Promise<ListItemRecord[]>
  getListItem(listId: string, itemId: string): Promise<ListItemRecord | null>
  upsertListItem(listId: string, itemId: string, deviceId: string, input: ItemUpsertInput): Promise<UpsertListItemResult>
  upsertListItems(listId: string, deviceId: string, entries: ItemBatchUpsertEntry[]): Promise<UpsertListItemResult[]>
  createShareToken(listId: string, deviceId: string): Promise<{ tokenId: string; createdAt: string }>
  recordShareTokenRedemption(tokenId: string, deviceId: string): Promise<void>

  createConnector(ownerDeviceId: string, keyHash: string, input: ConnectorInput): Promise<ConnectorRecord>
  listConnectors(ownerDeviceId: string): Promise<ConnectorRecord[]>
  findConnectorByKeyHash(keyHash: string): Promise<ConnectorRecord | null>
  /** `null` when the owner has no connector with that id. */
  updateConnector(connectorId: string, ownerDeviceId: string, input: ConnectorInput): Promise<ConnectorRecord | null>
  /** Replaces the key; `false` when the owner has no connector with that id. */
  rotateConnectorKey(connectorId: string, ownerDeviceId: string, keyHash: string): Promise<boolean>
  deleteConnector(connectorId: string, ownerDeviceId: string): Promise<boolean>
  markConnectorUsed(connectorId: string): Promise<void>
}
