import crypto from 'node:crypto'

import { z } from 'zod'

import { query, withTransaction } from '../db/client.js'
import {
  type ItemUpsertInput,
  type ListItemRecord,
  type ListRecord,
  type ListRepository,
  type PutListResult,
  type UpsertListItemResult,
} from './list-repository.js'

type Queryable = {
  query: (text: string, values?: unknown[]) => Promise<{ rows: unknown[]; rowCount: number | null }>
}

const listAccessQuery = `SELECT EXISTS(
   SELECT 1
     FROM shared_lists
    WHERE id = $1
      AND created_by_device_id = $2
 )
 OR EXISTS(
   SELECT 1
     FROM share_token_redemptions redemptions
     JOIN share_tokens tokens
       ON tokens.id = redemptions.token_id
    WHERE redemptions.device_id = $2
      AND tokens.list_id = $1
      AND tokens.revoked_at IS NULL
      AND (tokens.expires_at IS NULL OR tokens.expires_at > NOW())
 ) AS has_access`

const itemUpdateTieBreakDelimiter = '\u0001'
const accessRowSchema = z.object({ has_access: z.boolean() })

function toItemRecord(item: {
  id: string
  list_id: string
  name: string
  icon_name: string
  quantity_or_unit: string | null
  category: string
  deleted: boolean
  created_at: string
  updated_at: string
}): ListItemRecord {
  return {
    id: item.id,
    listId: item.list_id,
    name: item.name,
    iconName: item.icon_name,
    quantityOrUnit: item.quantity_or_unit ?? undefined,
    category: item.category,
    deleted: item.deleted,
    createdAt: item.created_at,
    updatedAt: item.updated_at,
  }
}

async function touchListUpdatedAt(client: Queryable, listId: string, updatedAt: string) {
  await client.query('UPDATE shared_lists SET updated_at = GREATEST(updated_at, $2::timestamptz) WHERE id = $1', [listId, updatedAt])
}

function computeItemTieBreakValue(item: ItemUpsertInput): string {
  return `${item.name}${itemUpdateTieBreakDelimiter}${item.iconName}${itemUpdateTieBreakDelimiter}${item.quantityOrUnit ?? ''}${itemUpdateTieBreakDelimiter}${item.category}${itemUpdateTieBreakDelimiter}${item.deleted}`
}

async function hasListAccessWithClient(client: Queryable, listId: string, deviceId: string): Promise<boolean> {
  const accessResult = await client.query(listAccessQuery, [listId, deviceId])
  const parsed = accessRowSchema.safeParse(accessResult.rows[0])
  return parsed.success ? parsed.data.has_access : false
}

export class PostgresListRepository implements ListRepository {
  async ping(): Promise<void> {
    await query('SELECT 1')
  }

  async hasListAccess(listId: string, deviceId: string): Promise<boolean> {
    const accessResult = await query<{ has_access: boolean }>(listAccessQuery, [listId, deviceId])
    return Boolean(accessResult.rows[0]?.has_access)
  }

  async findValidShareToken(shareToken: string): Promise<{ tokenId: string; listId: string } | null> {
    const tokenResult = await query<{ token_id: string; list_id: string }>(
      `SELECT id AS token_id, list_id
         FROM share_tokens
        WHERE id = $1
          AND revoked_at IS NULL
          AND (expires_at IS NULL OR expires_at > NOW())
        LIMIT 1`,
      [shareToken],
    )

    if (!tokenResult.rowCount) {
      return null
    }

    return {
      tokenId: tokenResult.rows[0].token_id,
      listId: tokenResult.rows[0].list_id,
    }
  }

  async putList(listId: string, name: string, deviceId: string): Promise<PutListResult> {
    return withTransaction(async (client) => {
      const existingListResult = await client.query<{ id: string }>('SELECT id FROM shared_lists WHERE id = $1 FOR UPDATE', [listId])

      if (!existingListResult.rowCount) {
        await client.query(
          'INSERT INTO shared_lists(id, name, created_by_device_id, created_at, updated_at) VALUES ($1, $2, $3, NOW(), NOW())',
          [listId, name, deviceId],
        )
        return { outcome: 'created' }
      }

      if (!(await hasListAccessWithClient(client, listId, deviceId))) {
        return { outcome: 'forbidden' }
      }

      await client.query('UPDATE shared_lists SET name = $1, updated_at = NOW() WHERE id = $2', [name, listId])

      return { outcome: 'updated' }
    })
  }

  async getList(listId: string): Promise<ListRecord | null> {
    const listResult = await query<{ id: string; name: string; created_at: string; updated_at: string }>(
      'SELECT id, name, created_at, updated_at FROM shared_lists WHERE id = $1 LIMIT 1',
      [listId],
    )

    if (!listResult.rowCount) {
      return null
    }

    return {
      id: listResult.rows[0].id,
      name: listResult.rows[0].name,
      createdAt: listResult.rows[0].created_at,
      updatedAt: listResult.rows[0].updated_at,
    }
  }

  async deleteList(listId: string, deviceId: string): Promise<boolean> {
    const result = await withTransaction(async (client) => {
      await client.query('SELECT id FROM shared_lists WHERE id = $1 FOR UPDATE', [listId])
      return client.query('DELETE FROM shared_lists WHERE id = $1 AND created_by_device_id = $2', [listId, deviceId])
    })

    return Boolean(result.rowCount)
  }

  async listItems(listId: string): Promise<ListItemRecord[]> {
    const itemsResult = await query<{
      id: string
      list_id: string
      name: string
      icon_name: string
      quantity_or_unit: string | null
      category: string
      deleted: boolean
      created_at: string
      updated_at: string
    }>(
      `SELECT id, list_id, name, icon_name, quantity_or_unit, category, deleted, created_at, updated_at
         FROM list_items
        WHERE list_id = $1
        ORDER BY created_at ASC, id ASC`,
      [listId],
    )

    return itemsResult.rows.map(toItemRecord)
  }

  async listItemsUpdatedAfter(listId: string, updatedAfter: string): Promise<ListItemRecord[]> {
    const itemsResult = await query<{
      id: string
      list_id: string
      name: string
      icon_name: string
      quantity_or_unit: string | null
      category: string
      deleted: boolean
      created_at: string
      updated_at: string
    }>(
      `SELECT id, list_id, name, icon_name, quantity_or_unit, category, deleted, created_at, updated_at
         FROM list_items
        WHERE list_id = $1 AND updated_at > $2
        ORDER BY updated_at ASC, id ASC`,
      [listId, updatedAfter],
    )

    return itemsResult.rows.map(toItemRecord)
  }

  async getListItem(listId: string, itemId: string): Promise<ListItemRecord | null> {
    const itemResult = await query<{
      id: string
      list_id: string
      name: string
      icon_name: string
      quantity_or_unit: string | null
      category: string
      deleted: boolean
      created_at: string
      updated_at: string
    }>(
      `SELECT id, list_id, name, icon_name, quantity_or_unit, category, deleted, created_at, updated_at
         FROM list_items
        WHERE id = $1 AND list_id = $2
        LIMIT 1`,
      [itemId, listId],
    )

    if (!itemResult.rowCount) {
      return null
    }

    return toItemRecord(itemResult.rows[0])
  }

  async upsertListItem(
    listId: string,
    itemId: string,
    deviceId: string,
    input: ItemUpsertInput,
  ): Promise<UpsertListItemResult> {
    const tieBreakValue = computeItemTieBreakValue(input)

    return withTransaction(async (client) => {
      await client.query('SELECT id FROM shared_lists WHERE id = $1 FOR UPDATE', [listId])

      const existingItemResult = await client.query<{ id: string; list_id: string }>('SELECT id, list_id FROM list_items WHERE id = $1 FOR UPDATE', [itemId])

      if (!existingItemResult.rowCount) {
        await client.query(
          `INSERT INTO list_items(id, list_id, name, icon_name, quantity_or_unit, category, deleted, created_by_device_id, created_at, updated_at, deleted_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW(), $9, CASE WHEN $7 THEN NOW() ELSE NULL END)`,
          [itemId, listId, input.name, input.iconName, input.quantityOrUnit ?? null, input.category, input.deleted, deviceId, input.updatedAt],
        )

        await touchListUpdatedAt(client, listId, input.updatedAt)

        return { outcome: 'created' }
      }

      if (existingItemResult.rows[0].list_id !== listId) {
        return { outcome: 'conflict' }
      }

      const updateResult = await client.query(
        `UPDATE list_items
            SET name = $1,
                icon_name = $2,
                quantity_or_unit = $3,
                category = $4,
                deleted = $5,
                updated_at = $6,
                deleted_at = CASE WHEN $5 THEN NOW() ELSE NULL END
          WHERE id = $7
            AND list_id = $8
            AND (
              updated_at < $6
              OR (
                updated_at = $6
                AND CONCAT_WS($10, name, icon_name, COALESCE(quantity_or_unit, ''), category, deleted::text) < $9
              )
            )`,
        [input.name, input.iconName, input.quantityOrUnit ?? null, input.category, input.deleted, input.updatedAt, itemId, listId, tieBreakValue, itemUpdateTieBreakDelimiter],
      )

      if (updateResult.rowCount) {
        await touchListUpdatedAt(client, listId, input.updatedAt)
      }

      return { outcome: 'updated' }
    })
  }

  async createShareToken(listId: string, deviceId: string): Promise<{ tokenId: string; createdAt: string }> {
    const tokenId = crypto.randomUUID()
    const result = await query<{ created_at: string }>(
      `INSERT INTO share_tokens(id, list_id, created_by_device_id, created_at)
       VALUES ($1, $2, $3, NOW())
       RETURNING created_at`,
      [tokenId, listId, deviceId],
    )

    return {
      tokenId,
      createdAt: result.rows[0].created_at,
    }
  }

  async recordShareTokenRedemption(tokenId: string, deviceId: string): Promise<void> {
    await query(
      `INSERT INTO share_token_redemptions(token_id, device_id, redeemed_at)
       VALUES ($1, $2, NOW())
       ON CONFLICT (token_id, device_id) DO NOTHING`,
      [tokenId, deviceId],
    )
  }
}

export const postgresListRepository: ListRepository = new PostgresListRepository()
