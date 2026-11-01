import crypto from 'node:crypto'

import { buildItemHash } from '@golist/shared/domain/sync'
import { isListType, type ListType } from '@golist/shared/domain/types'
import { z } from 'zod'

import { query, withTransaction } from '../db/client.js'
import { toItemSnapshot } from './item-snapshot.js'
import {
  type ConnectorInput,
  type ConnectorRecord,
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

// SQL condition: the device `device` created the list `list` or redeemed a
// valid share token for it.
const directAccessCondition = (list: string, device: string) => `(
  EXISTS(
    SELECT 1
      FROM shared_lists owned
     WHERE owned.id = ${list}
       AND owned.created_by_device_id = ${device}
  )
  OR EXISTS(
    SELECT 1
      FROM share_token_redemptions redemptions
      JOIN share_tokens tokens
        ON tokens.id = redemptions.token_id
     WHERE redemptions.device_id = ${device}
       AND tokens.list_id = ${list}
       AND tokens.revoked_at IS NULL
       AND (tokens.expires_at IS NULL OR tokens.expires_at > NOW())
  )
)`

// SQL condition for `ListRepository.hasListAccess`: direct access, or the
// device is a connector that includes the list and whose owner has direct
// access to it and still shows it in the app.
const accessCondition = (list: string, device: string) => `(
  ${directAccessCondition(list, device)}
  OR EXISTS(
    SELECT 1
      FROM mcp_connectors connectors
     WHERE connectors.device_id = ${device}
       AND (
         connectors.include_all_lists
         OR EXISTS(
           SELECT 1
             FROM mcp_connector_lists picked
            WHERE picked.connector_id = connectors.id
              AND picked.list_id = ${list}
         )
       )
       AND EXISTS(
         SELECT 1
           FROM device_visible_lists visible
          WHERE visible.device_id = connectors.owner_device_id
            AND visible.list_id = ${list}
       )
       AND ${directAccessCondition(list, 'connectors.owner_device_id')}
  )
)`

const listAccessQuery = `SELECT ${accessCondition('$1::uuid', '$2::uuid')} AS has_access`

const accessRowSchema = z.object({ has_access: z.boolean() })

const timestampSchema = z.union([z.string(), z.date()])
const existingItemRowSchema = z.object({
  id: z.string(),
  list_id: z.string(),
  name: z.string(),
  icon_name: z.string(),
  quantity_or_unit: z.string().nullable(),
  category: z.string(),
  deleted: z.boolean(),
  description: z.string().nullable(),
  points: z.number().nullable(),
  completed_at: timestampSchema.nullable(),
  due_date: timestampSchema.nullable(),
  assigned_to: z.string().nullable(),
  recurrence: z.string().nullable(),
  created_at: timestampSchema,
  updated_at: timestampSchema,
})

// node-postgres returns timestamptz columns as Date objects at runtime.
// Normalize to ISO strings here so millisecond precision survives later
// Date.parse calls (a Date coerced via toString() loses milliseconds).
type TimestampColumn = string | Date

function toIsoTimestamp(value: TimestampColumn): string {
  return (value instanceof Date ? value : new Date(value)).toISOString()
}

type ItemRow = {
  id: string
  list_id: string
  name: string
  icon_name: string
  quantity_or_unit: string | null
  category: string
  deleted: boolean
  description: string | null
  points: number | null
  completed_at: TimestampColumn | null
  due_date: TimestampColumn | null
  assigned_to: string | null
  recurrence: string | null
  created_at: TimestampColumn
  updated_at: TimestampColumn
}

const itemColumns = `id, list_id, name, icon_name, quantity_or_unit, category, deleted,
       description, points, completed_at, due_date, assigned_to, recurrence, created_at, updated_at`

const optionalIso = (value: TimestampColumn | null): string | undefined =>
  value === null ? undefined : toIsoTimestamp(value)

function toItemRecord(item: ItemRow): ListItemRecord {
  return {
    id: item.id,
    listId: item.list_id,
    name: item.name,
    iconName: item.icon_name,
    quantityOrUnit: item.quantity_or_unit ?? undefined,
    category: item.category,
    deleted: item.deleted,
    description: item.description ?? undefined,
    points: item.points ?? undefined,
    completedAt: optionalIso(item.completed_at),
    dueDate: optionalIso(item.due_date),
    assignedTo: item.assigned_to ?? undefined,
    recurrence: item.recurrence ?? undefined,
    createdAt: toIsoTimestamp(item.created_at),
    updatedAt: toIsoTimestamp(item.updated_at),
  }
}

/** Parameters $1..$6 shared by the item INSERT and UPDATE statements. */
const todoFieldValues = (input: ItemUpsertInput): unknown[] => [
  input.description ?? null,
  input.points ?? null,
  input.completedAt ?? null,
  input.dueDate ?? null,
  input.assignedTo ?? null,
  input.recurrence ?? null,
]

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
    `SELECT ${itemColumns} FROM list_items WHERE id = $1 FOR UPDATE`,
    [itemId],
  )

  if (!existingItemResult.rowCount) {
    await client.query(
      `INSERT INTO list_items(id, list_id, name, icon_name, quantity_or_unit, category, deleted, created_by_device_id, created_at, updated_at, deleted_at,
                              description, points, completed_at, due_date, assigned_to, recurrence)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW(), $9, CASE WHEN $7 THEN NOW() ELSE NULL END, $10, $11, $12, $13, $14, $15)`,
      [
        itemId,
        listId,
        input.name,
        input.iconName,
        input.quantityOrUnit ?? null,
        input.category,
        input.deleted,
        deviceId,
        input.updatedAt,
        ...todoFieldValues(input),
      ],
    )

    await touchListUpdatedAt(client, listId, input.updatedAt)
    return { outcome: 'created' }
  }

  const existing = toItemRecord(existingItemRowSchema.parse(existingItemResult.rows[0]))

  if (existing.listId !== listId) {
    return { outcome: 'conflict' }
  }

  const incomingUpdatedAt = Date.parse(input.updatedAt)
  const existingUpdatedAt = Date.parse(existing.updatedAt)
  const shouldUpdate =
    incomingUpdatedAt > existingUpdatedAt ||
    (incomingUpdatedAt === existingUpdatedAt &&
      buildItemHash(toItemSnapshot(itemId, listId, input)) > buildItemHash(toItemSnapshot(itemId, listId, existing)))

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
            deleted_at = CASE WHEN $5 THEN NOW() ELSE NULL END,
            description = $9,
            points = $10,
            completed_at = $11,
            due_date = $12,
            assigned_to = $13,
            recurrence = $14
      WHERE id = $7
        AND list_id = $8`,
    [
      input.name,
      input.iconName,
      input.quantityOrUnit ?? null,
      input.category,
      input.deleted,
      input.updatedAt,
      itemId,
      listId,
      ...todoFieldValues(input),
    ],
  )

  await touchListUpdatedAt(client, listId, input.updatedAt)
  return { outcome: 'updated' }
}

type ListRow = {
  id: string
  name: string
  list_type: string
  created_at: TimestampColumn
  updated_at: TimestampColumn
}

const listColumns = 'id, name, list_type, created_at, metadata_updated_at AS updated_at'

function toListRecord(row: ListRow): ListRecord {
  return {
    id: row.id,
    name: row.name,
    listType: isListType(row.list_type) ? row.list_type : 'shopping',
    createdAt: toIsoTimestamp(row.created_at),
    updatedAt: toIsoTimestamp(row.updated_at),
  }
}

type ConnectorRow = {
  id: string
  label: string
  device_id: string
  owner_device_id: string
  include_all_lists: boolean
  list_ids: string[]
  created_at: TimestampColumn
  last_used_at: TimestampColumn | null
}

const selectConnectors = `SELECT connectors.id, connectors.label, connectors.device_id, connectors.owner_device_id,
       connectors.include_all_lists, connectors.created_at, connectors.last_used_at,
       ARRAY(
         SELECT picked.list_id::text
           FROM mcp_connector_lists picked
          WHERE picked.connector_id = connectors.id
          ORDER BY picked.list_id
       ) AS list_ids
  FROM mcp_connectors connectors`

function toConnectorRecord(row: ConnectorRow): ConnectorRecord {
  return {
    id: row.id,
    label: row.label,
    deviceId: row.device_id,
    ownerDeviceId: row.owner_device_id,
    includeAllLists: row.include_all_lists,
    listIds: row.list_ids,
    createdAt: toIsoTimestamp(row.created_at),
    lastUsedAt: optionalIso(row.last_used_at),
  }
}

async function replaceConnectorLists(client: Queryable, connectorId: string, listIds: string[]) {
  await client.query('DELETE FROM mcp_connector_lists WHERE connector_id = $1', [connectorId])
  if (listIds.length > 0) {
    await client.query(
      // Joined with shared_lists: a picked list deleted since the access check
      // is skipped instead of failing the foreign key.
      `INSERT INTO mcp_connector_lists(connector_id, list_id)
       SELECT $1, lists.id FROM shared_lists lists WHERE lists.id = ANY($2::uuid[])
       ON CONFLICT DO NOTHING`,
      [connectorId, listIds],
    )
  }
}

export class PostgresListRepository implements ListRepository {
  async ping(): Promise<void> {
    await query('SELECT 1')
  }

  async hasListAccess(listId: string, deviceId: string): Promise<boolean> {
    const accessResult = await query<{ has_access: boolean }>(listAccessQuery, [listId, deviceId])
    return Boolean(accessResult.rows[0]?.has_access)
  }

  async listAccessibleLists(deviceId: string): Promise<ListRecord[]> {
    // Candidates first (lists the device or, for a connector, its owner
    // created or redeemed; all index lookups), then the exact access rule —
    // instead of evaluating the rule for every list in the table.
    const result = await query<ListRow>(
      `WITH devices AS (
         SELECT $1::uuid AS device_id
         UNION
         SELECT owner_device_id FROM mcp_connectors WHERE device_id = $1::uuid
       ),
       candidates AS (
         SELECT owned.id AS list_id
           FROM shared_lists owned
           JOIN devices ON devices.device_id = owned.created_by_device_id
         UNION
         SELECT tokens.list_id
           FROM share_token_redemptions redemptions
           JOIN devices ON devices.device_id = redemptions.device_id
           JOIN share_tokens tokens ON tokens.id = redemptions.token_id
       )
       SELECT ${listColumns}
         FROM shared_lists lists
        WHERE lists.id IN (SELECT list_id FROM candidates)
          AND ${accessCondition('lists.id', '$1::uuid')}
        ORDER BY lists.id`,
      [deviceId],
    )
    return result.rows.map(toListRecord)
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

  async putList(
    listId: string,
    name: string,
    deviceId: string,
    updatedAt?: string,
    listType?: ListType,
  ): Promise<PutListResult> {
    return withTransaction(async (client) => {
      const existingListResult = await client.query<{ id: string }>('SELECT id FROM shared_lists WHERE id = $1 FOR UPDATE', [listId])

      if (!existingListResult.rowCount) {
        await client.query(
          `INSERT INTO shared_lists(id, name, list_type, created_by_device_id, created_at, updated_at, metadata_updated_at)
           VALUES ($1, $2, $5, $3, NOW(), COALESCE($4::timestamptz, NOW()), COALESCE($4::timestamptz, NOW()))`,
          [listId, name, deviceId, updatedAt ?? null, listType ?? 'shopping'],
        )
        return { outcome: 'created' }
      }

      if (!(await hasListAccessWithClient(client, listId, deviceId))) {
        return { outcome: 'forbidden' }
      }

      if (updatedAt === undefined) {
        await client.query(
          `UPDATE shared_lists
              SET name = $1, list_type = COALESCE($3::text, list_type), updated_at = NOW(), metadata_updated_at = NOW()
            WHERE id = $2`,
          [name, listId, listType ?? null],
        )
        return { outcome: 'updated' }
      }

      // Mirrors the client's metadata LWW rule (`shouldAcceptListMetadata` in
      // `@golist/shared/domain/sync`): apply when the incoming change is
      // newer, or — on an equal millisecond timestamp — when it carries a
      // lexicographically greater name, or the same name and a greater list
      // type. The name comparison is done on raw UTF-8 bytes (`convert_to`)
      // rather than `<`/`>` so the result never depends on the database
      // collation and always matches the client's plain JS string comparison,
      // guaranteeing both sides pick the same winner. `$1` must be typed as
      // text explicitly: a bare `$1::bytea` makes Postgres infer the parameter
      // as bytea, and `SET name = $1` then stores its hex text form
      // ("\x4d696c6b") instead of the name. An unset `$4` (a client that
      // predates list types) keeps the stored type.
      const updateResult = await client.query(
        `UPDATE shared_lists
            SET name = $1::text,
                list_type = COALESCE($4::text, list_type),
                updated_at = GREATEST(updated_at, $3::timestamptz),
                metadata_updated_at = $3
          WHERE id = $2
            AND (
              date_trunc('milliseconds', metadata_updated_at) < $3::timestamptz
              OR (
                date_trunc('milliseconds', metadata_updated_at) = $3::timestamptz
                AND (
                  convert_to(name, 'UTF8') < convert_to($1::text, 'UTF8')
                  OR (name = $1::text AND list_type < COALESCE($4::text, list_type))
                )
              )
            )`,
        [name, listId, updatedAt, listType ?? null],
      )

      return { outcome: updateResult.rowCount ? 'updated' : 'ignored' }
    })
  }

  async getList(listId: string): Promise<ListRecord | null> {
    const listResult = await query<ListRow>(`SELECT ${listColumns} FROM shared_lists WHERE id = $1 LIMIT 1`, [listId])
    return listResult.rowCount ? toListRecord(listResult.rows[0]) : null
  }

  async deleteList(listId: string, deviceId: string): Promise<boolean> {
    const result = await withTransaction(async (client) => {
      await client.query('SELECT id FROM shared_lists WHERE id = $1 FOR UPDATE', [listId])
      return client.query('DELETE FROM shared_lists WHERE id = $1 AND created_by_device_id = $2', [listId, deviceId])
    })

    return Boolean(result.rowCount)
  }

  async listItems(listId: string): Promise<ListItemRecord[]> {
    const itemsResult = await query<ItemRow>(
      `SELECT ${itemColumns}
         FROM list_items
        WHERE list_id = $1
        ORDER BY created_at ASC, id ASC`,
      [listId],
    )

    return itemsResult.rows.map(toItemRecord)
  }

  async listItemsUpdatedAfter(listId: string, updatedAfter: string): Promise<ListItemRecord[]> {
    const itemsResult = await query<ItemRow>(
      `SELECT ${itemColumns}
         FROM list_items
        WHERE list_id = $1 AND updated_at > $2
        ORDER BY updated_at ASC, id ASC`,
      [listId, updatedAfter],
    )

    return itemsResult.rows.map(toItemRecord)
  }

  async getListItem(listId: string, itemId: string): Promise<ListItemRecord | null> {
    const itemResult = await query<ItemRow>(
      `SELECT ${itemColumns}
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

  async setVisibleLists(deviceId: string, listIds: string[]): Promise<void> {
    await withTransaction(async (client) => {
      await client.query('DELETE FROM device_visible_lists WHERE device_id = $1', [deviceId])
      await client.query(
        `INSERT INTO device_visible_lists(device_id, list_id)
         SELECT $1, list_id FROM unnest($2::uuid[]) AS list_id
         ON CONFLICT DO NOTHING`,
        [deviceId, listIds],
      )
    })
  }

  async createConnector(ownerDeviceId: string, keyHash: string, input: ConnectorInput): Promise<ConnectorRecord> {
    const connectorId = crypto.randomUUID()
    return withTransaction(async (client) => {
      await client.query(
        `INSERT INTO mcp_connectors(id, key_hash, device_id, owner_device_id, label, include_all_lists, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, NOW())`,
        [connectorId, keyHash, crypto.randomUUID(), ownerDeviceId, input.label, input.includeAllLists],
      )
      await replaceConnectorLists(client, connectorId, input.listIds)
      const result = await client.query<ConnectorRow>(`${selectConnectors} WHERE connectors.id = $1`, [connectorId])
      return toConnectorRecord(result.rows[0])
    })
  }

  async listConnectors(ownerDeviceId: string): Promise<ConnectorRecord[]> {
    const result = await query<ConnectorRow>(
      `${selectConnectors} WHERE connectors.owner_device_id = $1 ORDER BY connectors.created_at, connectors.id`,
      [ownerDeviceId],
    )
    return result.rows.map(toConnectorRecord)
  }

  async findConnectorByKeyHash(keyHash: string): Promise<ConnectorRecord | null> {
    const result = await query<ConnectorRow>(`${selectConnectors} WHERE connectors.key_hash = $1`, [keyHash])
    return result.rowCount ? toConnectorRecord(result.rows[0]) : null
  }

  async updateConnector(connectorId: string, ownerDeviceId: string, input: ConnectorInput): Promise<ConnectorRecord | null> {
    return withTransaction(async (client) => {
      const updated = await client.query(
        `UPDATE mcp_connectors SET label = $3, include_all_lists = $4
          WHERE id = $1 AND owner_device_id = $2`,
        [connectorId, ownerDeviceId, input.label, input.includeAllLists],
      )
      if (!updated.rowCount) {
        return null
      }
      await replaceConnectorLists(client, connectorId, input.listIds)
      const result = await client.query<ConnectorRow>(`${selectConnectors} WHERE connectors.id = $1`, [connectorId])
      return toConnectorRecord(result.rows[0])
    })
  }

  async rotateConnectorKey(connectorId: string, ownerDeviceId: string, keyHash: string): Promise<boolean> {
    const result = await query('UPDATE mcp_connectors SET key_hash = $3 WHERE id = $1 AND owner_device_id = $2', [
      connectorId,
      ownerDeviceId,
      keyHash,
    ])
    return Boolean(result.rowCount)
  }

  async deleteConnector(connectorId: string, ownerDeviceId: string): Promise<boolean> {
    const result = await query('DELETE FROM mcp_connectors WHERE id = $1 AND owner_device_id = $2', [connectorId, ownerDeviceId])
    return Boolean(result.rowCount)
  }

  async markConnectorUsed(connectorId: string): Promise<void> {
    await query('UPDATE mcp_connectors SET last_used_at = NOW() WHERE id = $1', [connectorId])
  }
}


export const postgresListRepository: ListRepository = new PostgresListRepository()
