import crypto from 'node:crypto'

import { type ItemUpsertInput, type ListItemRecord, type ListRecord, type ListRepository } from '../repositories/list-repository.js'

type ShareToken = {
  id: string
  listId: string
  createdByDeviceId: string
  createdAt: string
  revokedAt?: string
  expiresAt?: string
}

const itemUpdateTieBreakDelimiter = '\u0001'

function computeItemTieBreakValue(item: ItemUpsertInput | ListItemRecord): string {
  return `${item.name}${itemUpdateTieBreakDelimiter}${item.quantityOrUnit ?? ''}${itemUpdateTieBreakDelimiter}${item.category}${itemUpdateTieBreakDelimiter}${item.deleted}`
}

export class InMemoryListRepository implements ListRepository {
  private readonly lists = new Map<string, { data: ListRecord; createdByDeviceId: string }>()
  private readonly items = new Map<string, ListItemRecord>()
  private readonly shareTokens = new Map<string, ShareToken>()
  private readonly redemptions = new Set<string>()
  private pingError: Error | null = null

  setPingError(error: Error | null) {
    this.pingError = error
  }

  async ping(): Promise<void> {
    if (this.pingError) {
      throw this.pingError
    }
  }

  async hasListAccess(listId: string, deviceId: string): Promise<boolean> {
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

  async putList(listId: string, name: string, deviceId: string): Promise<{ statusCode: 200 | 201 | 403 }> {
    const existing = this.lists.get(listId)
    const now = new Date().toISOString()

    if (!existing) {
      this.lists.set(listId, {
        createdByDeviceId: deviceId,
        data: { id: listId, name, createdAt: now, updatedAt: now },
      })
      return { statusCode: 201 }
    }

    if (!(await this.hasListAccess(listId, deviceId))) {
      return { statusCode: 403 }
    }

    existing.data.name = name
    existing.data.updatedAt = now
    return { statusCode: 200 }
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

  async upsertListItem(listId: string, itemId: string, deviceId: string, input: ItemUpsertInput): Promise<{ statusCode: 201 | 204 | 409 }> {
    const existing = this.items.get(itemId)
    const list = this.lists.get(listId)
    if (!list) {
      return { statusCode: 409 }
    }

    if (!existing) {
      this.items.set(itemId, {
        id: itemId,
        listId,
        name: input.name,
        quantityOrUnit: input.quantityOrUnit,
        category: input.category,
        deleted: input.deleted,
        createdAt: new Date().toISOString(),
        updatedAt: input.updatedAt,
      })
      list.data.updatedAt = input.updatedAt > list.data.updatedAt ? input.updatedAt : list.data.updatedAt
      return { statusCode: 201 }
    }

    if (existing.listId !== listId) {
      return { statusCode: 409 }
    }

    const shouldUpdate =
      existing.updatedAt < input.updatedAt ||
      (existing.updatedAt === input.updatedAt && computeItemTieBreakValue(existing) < computeItemTieBreakValue(input))

    if (shouldUpdate) {
      this.items.set(itemId, {
        ...existing,
        name: input.name,
        quantityOrUnit: input.quantityOrUnit,
        category: input.category,
        deleted: input.deleted,
        updatedAt: input.updatedAt,
      })
      list.data.updatedAt = input.updatedAt > list.data.updatedAt ? input.updatedAt : list.data.updatedAt
    }

    void deviceId

    return { statusCode: 204 }
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
}
