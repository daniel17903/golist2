import crypto from 'node:crypto'

import { type FastifyInstance } from 'fastify'
import { z } from 'zod'

import { normalizeDeviceId, requireToken } from '../auth.js'
import { query, withTransaction } from '../db/client.js'

const listPutSchema = z.object({
  listId: z.uuid(),
  name: z.string().min(1),
})
const listNameUpdateSchema = z.object({ name: z.string().min(1) })
const listCreateHeadersSchema = z.object({ 'x-device-id': z.uuid().optional() })
const itemUpsertSchema = z.object({
  name: z.string().min(1),
  quantityOrUnit: z.string().min(1).optional(),
  category: z.string().min(1),
  deleted: z.boolean(),
  updatedAt: z.iso.datetime(),
})

const itemUpdateTieBreakDelimiter = '\u0001'

function computeItemTieBreakValue(item: {
  name: string
  quantityOrUnit?: string
  category: string
  deleted: boolean
}): string {
  return `${item.name}${itemUpdateTieBreakDelimiter}${item.quantityOrUnit ?? ''}${itemUpdateTieBreakDelimiter}${item.category}${itemUpdateTieBreakDelimiter}${item.deleted}`
}

export function registerListRoutes(app: FastifyInstance) {
  app.put('/v1/lists', async (request, reply) => {
    const body = listPutSchema.parse(request.body)
    const headers = listCreateHeadersSchema.parse(request.headers)
    const createdBy = normalizeDeviceId(headers['x-device-id'])

    const authHeader = request.headers.authorization
    const bearerToken = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null

    const result = await withTransaction(async (client) => {
      const existingListResult = await client.query<{
        id: string
        created_by_device_id: string
      }>('SELECT id, created_by_device_id FROM shared_lists WHERE id = $1 FOR UPDATE', [body.listId])

      if (!existingListResult.rowCount) {
        const tokenId = crypto.randomUUID()

        await client.query(
          'INSERT INTO shared_lists(id, name, created_by_device_id, created_at, updated_at) VALUES ($1, $2, $3, NOW(), NOW())',
          [body.listId, body.name, createdBy],
        )
        await client.query(
          'INSERT INTO share_tokens(id, list_id, created_by_device_id, created_at) VALUES ($1, $2, $3, NOW())',
          [tokenId, body.listId, createdBy],
        )
        await client.query(
          `INSERT INTO share_token_redemptions(token_id, device_id, redeemed_at)
           VALUES ($1, $2, NOW())
           ON CONFLICT (token_id, device_id) DO NOTHING`,
          [tokenId, createdBy],
        )

        return { statusCode: 201, shareToken: tokenId }
      }

      if (!headers['x-device-id'] || !bearerToken) {
        return { statusCode: 403 as const }
      }

      const tokenResult = await client.query<{ id: string; list_id: string }>(
        `SELECT id, list_id
           FROM share_tokens
          WHERE id = $1
            AND list_id = $2
            AND revoked_at IS NULL
            AND (expires_at IS NULL OR expires_at > NOW())
          LIMIT 1`,
        [bearerToken, body.listId],
      )

      if (!tokenResult.rowCount) {
        return { statusCode: 403 as const }
      }

      const accessResult = await client.query(
        `SELECT 1
           FROM share_token_redemptions
          WHERE token_id = $1
            AND device_id = $2
          LIMIT 1`,
        [bearerToken, headers['x-device-id']],
      )

      const isCreator = existingListResult.rows[0].created_by_device_id === headers['x-device-id']

      if (!accessResult.rowCount && !isCreator) {
        return { statusCode: 403 as const }
      }

      await client.query('UPDATE shared_lists SET name = $1, updated_at = NOW() WHERE id = $2', [body.name, body.listId])

      return { statusCode: 200 as const, shareToken: bearerToken }
    })

    reply.code(result.statusCode)
    if (result.statusCode === 403) {
      return { message: 'Forbidden' }
    }

    return { listId: body.listId, shareToken: result.shareToken }
  })

  app.get('/v1/lists/:shareToken', { preHandler: requireToken }, async (request) => {
    const auth = request.auth!

    const listResult = await query<{
      id: string
      name: string
      created_at: string
      updated_at: string
    }>('SELECT id, name, created_at, updated_at FROM shared_lists WHERE id = $1 LIMIT 1', [auth.listId])

    if (!listResult.rowCount) {
      return {}
    }

    const itemsResult = await query<{
      id: string
      name: string
      quantity_or_unit: string | null
      category: string
      deleted: boolean
      created_at: string
      updated_at: string
    }>(
      `SELECT id, name, quantity_or_unit, category, deleted, created_at, updated_at
         FROM list_items
        WHERE list_id = $1
        ORDER BY created_at ASC, id ASC`,
      [auth.listId],
    )

    const list = listResult.rows[0]

    return {
      listId: list.id,
      name: list.name,
      createdAt: list.created_at,
      updatedAt: list.updated_at,
      items: itemsResult.rows.map((item) => ({
        id: item.id,
        name: item.name,
        quantityOrUnit: item.quantity_or_unit ?? undefined,
        category: item.category,
        deleted: item.deleted,
        createdAt: item.created_at,
        updatedAt: item.updated_at,
      })),
    }
  })

  app.delete('/v1/lists/:shareToken', { preHandler: requireToken }, async (request, reply) => {
    const result = await withTransaction(async (client) => {
      await client.query('SELECT id FROM shared_lists WHERE id = $1 FOR UPDATE', [request.auth!.listId])

      return client.query('DELETE FROM shared_lists WHERE id = $1 AND created_by_device_id = $2', [
        request.auth!.listId,
        request.auth!.deviceId,
      ])
    })

    if (!result.rowCount) {
      reply.code(403)
      return { message: 'Forbidden' }
    }

    reply.code(204)
  })

  app.patch('/v1/lists/:shareToken/name', { preHandler: requireToken }, async (request, reply) => {
    const body = listNameUpdateSchema.parse(request.body)

    await withTransaction(async (client) => {
      await client.query('SELECT id FROM shared_lists WHERE id = $1 FOR UPDATE', [request.auth!.listId])
      await client.query('UPDATE shared_lists SET name = $1, updated_at = NOW() WHERE id = $2', [body.name, request.auth!.listId])
    })

    reply.code(204)
  })

  app.get('/v1/lists/:shareToken/items', { preHandler: requireToken }, async (request) => {
    const querystring = z.object({ updatedAfter: z.iso.datetime() }).parse(request.query)

    const itemsResult = await query<{
      id: string
      name: string
      quantity_or_unit: string | null
      category: string
      deleted: boolean
      created_at: string
      updated_at: string
    }>(
      `SELECT id, name, quantity_or_unit, category, deleted, created_at, updated_at
         FROM list_items
        WHERE list_id = $1 AND updated_at > $2
        ORDER BY updated_at ASC, id ASC`,
      [request.auth!.listId, querystring.updatedAfter],
    )

    return {
      items: itemsResult.rows.map((item) => ({
        id: item.id,
        name: item.name,
        quantityOrUnit: item.quantity_or_unit ?? undefined,
        category: item.category,
        deleted: item.deleted,
        createdAt: item.created_at,
        updatedAt: item.updated_at,
      })),
    }
  })

  app.get('/v1/lists/:shareToken/items/:itemId', { preHandler: requireToken }, async (request, reply) => {
    const params = z.object({ itemId: z.uuid() }).parse(request.params)
    const itemResult = await query<{
      id: string
      name: string
      quantity_or_unit: string | null
      category: string
      deleted: boolean
      created_at: string
      updated_at: string
    }>(
      `SELECT id, name, quantity_or_unit, category, deleted, created_at, updated_at
         FROM list_items
        WHERE id = $1 AND list_id = $2
        LIMIT 1`,
      [params.itemId, request.auth!.listId],
    )

    if (!itemResult.rowCount) {
      reply.code(404)
      return { message: 'Item not found' }
    }

    const item = itemResult.rows[0]
    return {
      id: item.id,
      name: item.name,
      quantityOrUnit: item.quantity_or_unit ?? undefined,
      category: item.category,
      deleted: item.deleted,
      createdAt: item.created_at,
      updatedAt: item.updated_at,
    }
  })

  app.put('/v1/lists/:shareToken/items/:itemId', { preHandler: requireToken }, async (request, reply) => {
    const params = z.object({ itemId: z.uuid() }).parse(request.params)
    const body = itemUpsertSchema.parse(request.body)
    const tieBreakValue = computeItemTieBreakValue(body)

    const result = await withTransaction(async (client) => {
      await client.query('SELECT id FROM shared_lists WHERE id = $1 FOR UPDATE', [request.auth!.listId])

      const existingItemResult = await client.query<{
        id: string
        list_id: string
      }>('SELECT id, list_id FROM list_items WHERE id = $1 FOR UPDATE', [params.itemId])

      if (!existingItemResult.rowCount) {
        await client.query(
          `INSERT INTO list_items(id, list_id, name, quantity_or_unit, category, deleted, created_by_device_id, created_at, updated_at, deleted_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), $8, CASE WHEN $6 THEN NOW() ELSE NULL END)`,
          [
            params.itemId,
            request.auth!.listId,
            body.name,
            body.quantityOrUnit ?? null,
            body.category,
            body.deleted,
            request.auth!.deviceId,
            body.updatedAt,
          ],
        )

        await client.query('UPDATE shared_lists SET updated_at = GREATEST(updated_at, $2::timestamptz) WHERE id = $1', [
          request.auth!.listId,
          body.updatedAt,
        ])

        return { statusCode: 201 }
      }

      if (existingItemResult.rows[0].list_id !== request.auth!.listId) {
        return { statusCode: 409 }
      }

      const updateResult = await client.query(
        `UPDATE list_items
            SET name = $1,
                quantity_or_unit = $2,
                category = $3,
                deleted = $4,
                updated_at = $5,
                deleted_at = CASE WHEN $4 THEN NOW() ELSE NULL END
          WHERE id = $6
            AND list_id = $7
            AND (
              updated_at < $5
              OR (
                updated_at = $5
                AND CONCAT_WS($9, name, COALESCE(quantity_or_unit, ''), category, deleted::text) < $8
              )
            )`,
        [
          body.name,
          body.quantityOrUnit ?? null,
          body.category,
          body.deleted,
          body.updatedAt,
          params.itemId,
          request.auth!.listId,
          tieBreakValue,
          itemUpdateTieBreakDelimiter,
        ],
      )

      if (updateResult.rowCount) {
        await client.query('UPDATE shared_lists SET updated_at = GREATEST(updated_at, $2::timestamptz) WHERE id = $1', [
          request.auth!.listId,
          body.updatedAt,
        ])
      }

      return { statusCode: 204 }
    })

    reply.code(result.statusCode)
    if (result.statusCode === 409) {
      return { message: 'Item id belongs to another list' }
    }
  })
}
