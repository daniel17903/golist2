import crypto from 'node:crypto'

import { buildItemHash, shouldAcceptListMetadata } from '@golist/shared/domain/sync'
import type { ListType } from '@golist/shared/domain/types'

import { toItemSnapshot } from '../repositories/item-snapshot.js'

import {
  type ConnectorInput,
  type ConnectorRecord,
  type ItemUpsertInput,
  type ItemBatchUpsertEntry,
  type ListItemRecord,
  type ListRecord,
  type ListRepository,
  type PutListResult,
  type UpsertListItemResult,
} from '../repositories/list-repository.js'

// Spread explicitly (all keys, `undefined` included) so an update clears
// todo fields the incoming version no longer has, like the Postgres UPDATE.
const todoFieldsOf = (input: ItemUpsertInput) => ({
  description: input.description,
  points: input.points,
  completedAt: input.completedAt,
  dueDate: input.dueDate,
  assignedTo: input.assignedTo,
  recurrence: input.recurrence,
})

type ShareToken = {
  id: string
  listId: string
  createdByDeviceId: string
  createdAt: string
  revokedAt?: string
  expiresAt?: string
}

export class InMemoryListRepository implements ListRepository {
  private readonly lists = new Map<string, { data: ListRecord; createdByDeviceId: string }>()
  private readonly items = new Map<string, ListItemRecord>()
  private readonly shareTokens = new Map<string, ShareToken>()
  private readonly redemptions = new Set<string>()
  private readonly visibleLists = new Map<string, Set<string>>()
  private readonly connectors = new Map<string, ConnectorRecord & { keyHash: string }>()
  private pingError: Error | null = null

  setPingError(error: Error | null) {
    this.pingError = error
  }

  async ping(): Promise<void> {
    if (this.pingError) {
      throw this.pingError
    }
  }

  private hasDirectListAccess(listId: string, deviceId: string): boolean {
    const list = this.lists.get(listId)
    if (!list) {
      return false
    }

    if (list.createdByDeviceId === deviceId) {
      return true
    }

    for (const token of this.shareTokens.values()) {
      if (token.listId !== listId || token.revokedAt) {
        continue
      }

      if (token.expiresAt && token.expiresAt <= new Date().toISOString()) {
        continue
      }

      if (this.redemptions.has(`${token.id}:${deviceId}`)) {
        return true
      }
    }

    return false
  }

  async hasListAccess(listId: string, deviceId: string): Promise<boolean> {
    if (this.hasDirectListAccess(listId, deviceId)) {
      return true
    }

    const connector = [...this.connectors.values()].find((entry) => entry.deviceId === deviceId)
    return (
      connector !== undefined &&
      (connector.includeAllLists || connector.listIds.includes(listId)) &&
      (this.visibleLists.get(connector.ownerDeviceId)?.has(listId) ?? false) &&
      this.hasDirectListAccess(listId, connector.ownerDeviceId)
    )
  }

  async listAccessibleLists(deviceId: string): Promise<ListRecord[]> {
    const accessible: ListRecord[] = []
    for (const [listId, list] of this.lists) {
      if (await this.hasListAccess(listId, deviceId)) {
        accessible.push({ ...list.data })
      }
    }
    // Plain code-unit order, like ORDER BY on the uuid column.
    return accessible.sort((a, b) => Number(a.id > b.id) - Number(a.id < b.id))
  }

  async findValidShareToken(shareToken: string): Promise<{ tokenId: string; listId: string } | null> {
    const token = this.shareTokens.get(shareToken)
    if (!token || token.revokedAt) {
      return null
    }

    if (token.expiresAt && token.expiresAt <= new Date().toISOString()) {
      return null
    }

    return { tokenId: token.id, listId: token.listId }
  }

  async putList(
    listId: string,
    name: string,
    deviceId: string,
    updatedAt?: string,
    listType?: ListType,
  ): Promise<PutListResult> {
    const existing = this.lists.get(listId)
    const now = new Date().toISOString()

    if (!existing) {
      this.lists.set(listId, {
        createdByDeviceId: deviceId,
        data: { id: listId, name, listType: listType ?? 'shopping', createdAt: now, updatedAt: updatedAt ?? now },
      })
      return { outcome: 'created' }
    }

    if (!(await this.hasListAccess(listId, deviceId))) {
      return { outcome: 'forbidden' }
    }

    // An unset type (a client that predates list types) keeps the stored one.
    const nextListType = listType ?? existing.data.listType

    if (updatedAt === undefined) {
      existing.data.name = name
      existing.data.listType = nextListType
      existing.data.updatedAt = now
      return { outcome: 'updated' }
    }

    // Same deterministic tie-break rule the client and Postgres repository
    // apply (`shouldAcceptListMetadata`), so all three agree on a winner when
    // two renames share the same millisecond `updatedAt`.
    const incomingUpdatedAt = Date.parse(updatedAt)
    const existingUpdatedAt = Date.parse(existing.data.updatedAt)
    if (
      !shouldAcceptListMetadata(
        { name, listType: nextListType, updatedAt: incomingUpdatedAt },
        { name: existing.data.name, listType: existing.data.listType, updatedAt: existingUpdatedAt },
      )
    ) {
      return { outcome: 'ignored' }
    }

    existing.data.name = name
    existing.data.listType = nextListType
    existing.data.updatedAt = updatedAt
    return { outcome: 'updated' }
  }

  async getList(listId: string): Promise<ListRecord | null> {
    const list = this.lists.get(listId)
    return list ? { ...list.data } : null
  }

  async deleteList(listId: string, deviceId: string): Promise<boolean> {
    const list = this.lists.get(listId)
    if (!list || list.createdByDeviceId !== deviceId) {
      return false
    }

    this.lists.delete(listId)
    for (const connector of this.connectors.values()) {
      connector.listIds = connector.listIds.filter((id) => id !== listId)
    }
    for (const [itemId, item] of this.items.entries()) {
      if (item.listId === listId) {
        this.items.delete(itemId)
      }
    }

    return true
  }

  async listItems(listId: string): Promise<ListItemRecord[]> {
    return [...this.items.values()]
      .filter((item) => item.listId === listId)
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id))
      .map((item) => ({ ...item }))
  }

  async listItemsUpdatedAfter(listId: string, updatedAfter: string): Promise<ListItemRecord[]> {
    return [...this.items.values()]
      .filter((item) => item.listId === listId && item.updatedAt > updatedAfter)
      .sort((a, b) => a.updatedAt.localeCompare(b.updatedAt) || a.id.localeCompare(b.id))
      .map((item) => ({ ...item }))
  }

  async getListItem(listId: string, itemId: string): Promise<ListItemRecord | null> {
    const item = this.items.get(itemId)
    if (!item || item.listId !== listId) {
      return null
    }

    return { ...item }
  }

  async upsertListItem(listId: string, itemId: string, deviceId: string, input: ItemUpsertInput): Promise<UpsertListItemResult> {
    const existing = this.items.get(itemId)
    const list = this.lists.get(listId)
    if (!list) {
      return { outcome: 'conflict' }
    }

    if (!existing) {
      this.items.set(itemId, {
        id: itemId,
        listId,
        name: input.name,
        iconName: input.iconName,
        quantityOrUnit: input.quantityOrUnit,
        category: input.category,
        deleted: input.deleted,
        ...todoFieldsOf(input),
        createdAt: new Date().toISOString(),
        updatedAt: input.updatedAt,
      })
      return { outcome: 'created' }
    }

    if (existing.listId !== listId) {
      return { outcome: 'conflict' }
    }

    void deviceId

    // Same LWW rule the clients apply (shared sync hashes).
    const incomingUpdatedAt = Date.parse(input.updatedAt)
    const existingUpdatedAt = Date.parse(existing.updatedAt)
    const shouldUpdate =
      incomingUpdatedAt > existingUpdatedAt ||
      (incomingUpdatedAt === existingUpdatedAt &&
        buildItemHash(toItemSnapshot(itemId, listId, input)) > buildItemHash(toItemSnapshot(existing.id, existing.listId, existing)))

    if (!shouldUpdate) {
      return { outcome: 'ignored' }
    }

    this.items.set(itemId, {
      ...existing,
      name: input.name,
      iconName: input.iconName,
      quantityOrUnit: input.quantityOrUnit,
      category: input.category,
      deleted: input.deleted,
      ...todoFieldsOf(input),
      updatedAt: input.updatedAt,
    })

    return { outcome: 'updated' }
  }

  async upsertListItems(
    listId: string,
    deviceId: string,
    entries: ItemBatchUpsertEntry[],
  ): Promise<UpsertListItemResult[]> {
    const listSnapshot = [...this.lists.entries()].map(([id, list]) => [
      id,
      { createdByDeviceId: list.createdByDeviceId, data: { ...list.data } },
    ] as const)
    const itemSnapshot = [...this.items.entries()].map(([id, item]) => [id, { ...item }] as const)

    try {
      const results: UpsertListItemResult[] = []
      for (const entry of entries) {
        results.push(await this.upsertListItem(listId, entry.itemId, deviceId, entry.input))
      }
      return results
    } catch (error) {
      this.lists.clear()
      listSnapshot.forEach(([id, list]) => this.lists.set(id, list))
      this.items.clear()
      itemSnapshot.forEach(([id, item]) => this.items.set(id, item))
      throw error
    }
  }

  async createShareToken(listId: string, deviceId: string): Promise<{ tokenId: string; createdAt: string }> {
    const tokenId = crypto.randomUUID()
    const createdAt = new Date().toISOString()
    this.shareTokens.set(tokenId, {
      id: tokenId,
      listId,
      createdByDeviceId: deviceId,
      createdAt,
    })

    return { tokenId, createdAt }
  }

  async recordShareTokenRedemption(tokenId: string, deviceId: string): Promise<void> {
    this.redemptions.add(`${tokenId}:${deviceId}`)
  }

  private toConnectorRecord({ keyHash, ...connector }: ConnectorRecord & { keyHash: string }): ConnectorRecord {
    void keyHash
    return { ...connector, listIds: [...connector.listIds] }
  }

  async setVisibleLists(deviceId: string, listIds: string[]): Promise<void> {
    this.visibleLists.set(deviceId, new Set(listIds))
  }

  async createConnector(ownerDeviceId: string, keyHash: string, input: ConnectorInput): Promise<ConnectorRecord> {
    const connector = {
      id: crypto.randomUUID(),
      keyHash,
      label: input.label,
      deviceId: crypto.randomUUID(),
      ownerDeviceId,
      includeAllLists: input.includeAllLists,
      listIds: [...new Set(input.listIds)].sort(),
      createdAt: new Date().toISOString(),
    }
    this.connectors.set(connector.id, connector)
    return this.toConnectorRecord(connector)
  }

  async listConnectors(ownerDeviceId: string): Promise<ConnectorRecord[]> {
    return [...this.connectors.values()]
      .filter((connector) => connector.ownerDeviceId === ownerDeviceId)
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id))
      .map((connector) => this.toConnectorRecord(connector))
  }

  async findConnectorByKeyHash(keyHash: string): Promise<ConnectorRecord | null> {
    const connector = [...this.connectors.values()].find((entry) => entry.keyHash === keyHash)
    return connector ? this.toConnectorRecord(connector) : null
  }

  async updateConnector(connectorId: string, ownerDeviceId: string, input: ConnectorInput): Promise<ConnectorRecord | null> {
    const connector = this.connectors.get(connectorId)
    if (!connector || connector.ownerDeviceId !== ownerDeviceId) {
      return null
    }
    connector.label = input.label
    connector.includeAllLists = input.includeAllLists
    connector.listIds = [...new Set(input.listIds)].sort()
    return this.toConnectorRecord(connector)
  }

  async rotateConnectorKey(connectorId: string, ownerDeviceId: string, keyHash: string): Promise<boolean> {
    const connector = this.connectors.get(connectorId)
    if (!connector || connector.ownerDeviceId !== ownerDeviceId) {
      return false
    }
    connector.keyHash = keyHash
    return true
  }

  async deleteConnector(connectorId: string, ownerDeviceId: string): Promise<boolean> {
    const connector = this.connectors.get(connectorId)
    if (!connector || connector.ownerDeviceId !== ownerDeviceId) {
      return false
    }
    this.connectors.delete(connectorId)
    return true
  }

  async markConnectorUsed(connectorId: string): Promise<void> {
    const connector = this.connectors.get(connectorId)
    if (connector) {
      connector.lastUsedAt = new Date().toISOString()
    }
  }
}
