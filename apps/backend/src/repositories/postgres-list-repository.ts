import crypto from 'node:crypto'

import { buildItemHash } from '@golist/shared/domain/sync'
import { z } from 'zod'

import { query, withTransaction } from '../db/client.js'
import {
  type ItemBatchUpsertEntry,
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

const accessRowSchema = z.object({ has_access: z.boolean() })

// node-postgres returns timestamptz columns as Date objects at runtime.
// Normalize to ISO strings here so millisecond precision survives later
// Date.parse calls (a Date coerced via toString() loses milliseconds).
type TimestampColumn = string | Date

function toIsoTimestamp(value: TimestampColumn): string {
  return (value instanceof Date ? value : new Date(value)).toISOString()
}

function toItemRecord(item: {
  id: string
  list_id: string
  name: string
  icon_name: string
  quantity_or_unit: string | null
  category: string
  deleted: boolean
  created_at: TimestampColumn
  updated_at: TimestampColumn
}): ListItemRecord {
  return {
    id: item.id,
    listId: item.list_id,
    name: item.name,
    iconName: item.icon_name,
    quantityOrUnit: item.quantity_or_unit ?? undefined,
    category: item.category,
    deleted: item.deleted,
    createdAt: toIsoTimestamp(item.created_at),
    updatedAt: toIsoTimestamp(item.updated_at),
  }
}

async function touchListUpdatedAt(client: Queryable, listId: string, updatedAt: string) {
  await client.query('UPDATE shared_lists SET updated_at = GREATEST(updated_at, $2::timestamptz) WHERE id = $1', [listId, updatedAt])
}

async function hasListAccessWithClient(client: Queryable, listId: string, deviceId: string): Promise<boolean> {
  const accessResult = await client.query(listAccessQuery, [listId, deviceId])
  const parsed = accessRowSchema.safeParse(accessResult.rows[0])
  return parsed.success ? parsed.data.has_access : false
}

async function upsertListItemWithClient(
  client: Queryable,
  listId: string,
  itemId: string,
  deviceId: string,
  input: ItemUpsertInput,
): Promise<UpsertListItemResult> {
  const existingItemResult = await client.query(
    'SELECT list_id, name, icon_name, quantity_or_unit, category, deleted, updated_at FROM list_items WHERE id = $1 FOR UPDATE',
    [itemId],
  )

  if (!existingItemResult.rowCount) {
    await client.query(
      `INSERT INTO list_items(id, list_id, name, icon_name, quantity_or_unit, category, deleted, created_by_device_id, created_at, updated_at, deleted_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW(), $9, CASE WHEN $7 THEN NOW() ELSE NULL END)`,
      [itemId, listId, input.name, input.iconName, input.quantityOrUnit ?? null, input.category, input.deleted, deviceId, input.updatedAt],
    )

    await touchListUpdatedAt(client, listId, input.updatedAt)
    return { outcome: 'created' }
  }

  const existing = z.object({
    list_id: z.string(),
    name: z.string(),
    icon_name: z.string(),
    quantity_or_unit: z.string().nullable(),
    category: z.string(),
    deleted: z.boolean(),
    updated_at: z.union([z.string(), z.date()]),
  }).parse(existingItemResult.rows[0])

  if (existing.list_id !== listId) {
    return { outcome: 'conflict' }
  }

  const incomingUpdatedAt = Date.parse(input.updatedAt)
  const existingUpdatedAt = Date.parse(toIsoTimestamp(existing.updated_at))
  const shouldUpdate =
    incomingUpdatedAt > existingUpdatedAt ||
    (incomingUpdatedAt === existingUpdatedAt &&
      buildItemHash({
        id: itemId,
        listId,
        name: input.name,
        iconName: input.iconName,
        quantityOrUnit: input.quantityOrUnit,
        category: input.category,
        deleted: input.deleted,
        updatedAt: incomingUpdatedAt,
      }) >
        buildItemHash({
          id: itemId,
          listId,
          name: existing.name,
          iconName: existing.icon_name,
          quantityOrUnit: existing.quantity_or_unit ?? undefined,
          category: existing.category,
          deleted: existing.deleted,
          updatedAt: existingUpdatedAt,
        }))

  if (!shouldUpdate) {
    return { outcome: 'ignored' }
  }

  await client.query(
    `UPDATE list_items
        SET name = $1,
            icon_name = $2,
            quantity_or_unit = $3,
            category = $4,
            deleted = $5,
            updated_at = $6,
            deleted_at = CASE WHEN $5 THEN NOW() ELSE NULL END
      WHERE id = $7
        AND list_id = $8`,
    [input.name, input.iconName, input.quantityOrUnit ?? null, input.category, input.deleted, input.updatedAt, itemId, listId],
  )

  await touchListUpdatedAt(client, listId, input.updatedAt)
  return { outcome: 'updated' }
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

  async putList(listId: string, name: string, deviceId: string, updatedAt?: string): Promise<PutListResult> {
    return withTransaction(async (client) => {
      const existingListResult = await client.query<{ id: string }>('SELECT id FROM shared_lists WHERE id = $1 FOR UPDATE', [listId])

      if (!existingListResult.rowCount) {
        await client.query(
          'INSERT INTO shared_lists(id, name, created_by_device_id, created_at, updated_at, metadata_updated_at) VALUES ($1, $2, $3, NOW(), COALESCE($4::timestamptz, NOW()), COALESCE($4::timestamptz, NOW()))',
          [listId, name, deviceId, updatedAt ?? null],
        )
        return { outcome: 'created' }
      }

      if (!(await hasListAccessWithClient(client, listId, deviceId))) {
        return { outcome: 'forbidden' }
      }

      if (updatedAt === undefined) {
        await client.query('UPDATE shared_lists SET name = $1, updated_at = NOW(), metadata_updated_at = NOW() WHERE id = $2', [name, listId])
        return { outcome: 'updated' }
      }

      // Mirrors the client's metadata LWW rule (`shouldAcceptListMetadata` in
      // `@golist/shared/domain/sync`): apply when the incoming change is
      // newer, or — on an equal millisecond timestamp — when it carries a
      // lexicographically greater name. The name comparison is done on raw
      // UTF-8 bytes (`bytea`) rather than `<`/`>` so the result never depends
      // on the database collation and always matches the client's plain JS
      // string comparison, guaranteeing both sides pick the same winner.
      const updateResult = await client.query(
        `UPDATE shared_lists
            SET name = $1,
                updated_at = GREATEST(updated_at, $3::timestamptz),
                metadata_updated_at = $3
          WHERE id = $2
            AND (
              date_trunc('milliseconds', metadata_updated_at) < $3::timestamptz
              OR (date_trunc('milliseconds', metadata_updated_at) = $3::timestamptz AND name::bytea < $1::bytea)
            )`,
        [name, listId, updatedAt],
      )

      return { outcome: updateResult.rowCount ? 'updated' : 'ignored' }
    })
  }

  async getList(listId: string): Promise<ListRecord | null> {
    const listResult = await query<{ id: string; name: string; created_at: TimestampColumn; updated_at: TimestampColumn }>(
      'SELECT id, name, created_at, metadata_updated_at AS updated_at FROM shared_lists WHERE id = $1 LIMIT 1',
      [listId],
    )

    if (!listResult.rowCount) {
      return null
    }

    return {
      id: listResult.rows[0].id,
      name: listResult.rows[0].name,
      createdAt: toIsoTimestamp(listResult.rows[0].created_at),
      updatedAt: toIsoTimestamp(listResult.rows[0].updated_at),
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
      created_at: TimestampColumn
      updated_at: TimestampColumn
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
      created_at: TimestampColumn
      updated_at: TimestampColumn
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
      created_at: TimestampColumn
      updated_at: TimestampColumn
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
    const [result] = await this.upsertListItems(listId, deviceId, [{ itemId, input }])
    return result
  }

  async upsertListItems(
    listId: string,
    deviceId: string,
    entries: ItemBatchUpsertEntry[],
  ): Promise<UpsertListItemResult[]> {
    return withTransaction(async (client) => {
      await client.query('SELECT id FROM shared_lists WHERE id = $1 FOR UPDATE', [listId])

      const results: UpsertListItemResult[] = []
      for (const entry of entries) {
        results.push(await upsertListItemWithClient(client, listId, entry.itemId, deviceId, entry.input))
      }
      return results
    })
  }

  async createShareToken(listId: string, deviceId: string): Promise<{ tokenId: string; createdAt: string }> {
    const tokenId = crypto.randomUUID()
    const result = await query<{ created_at: TimestampColumn }>(
      `INSERT INTO share_tokens(id, list_id, created_by_device_id, created_at)
       VALUES ($1, $2, $3, NOW())
       RETURNING created_at`,
      [tokenId, listId, deviceId],
    )

    return {
      tokenId,
      createdAt: toIsoTimestamp(result.rows[0].created_at),
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
