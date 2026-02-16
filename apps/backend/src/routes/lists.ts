import crypto from 'node:crypto'

import { type FastifyInstance } from 'fastify'
import { z } from 'zod'

import { normalizeDeviceId, requireToken } from '../auth.js'
import { query, withTransaction } from '../db/client.js'

const listCreateSchema = z.object({
  listId: z.uuid(),
  name: z.string().min(1),
})
const listNameUpdateSchema = z.object({ name: z.string().min(1) })
const listCreateQuerySchema = z.object({ deviceId: z.uuid().optional() })
const itemUpsertSchema = z.object({
  name: z.string().min(1),
  category: z.string().min(1),
  deleted: z.boolean(),
  updatedAt: z.iso.datetime(),
})

const itemUpdateTieBreakDelimiter = '\u0001'

function computeItemTieBreakValue(item: { name: string; category: string; deleted: boolean }): string {
  return `${item.name}${itemUpdateTieBreakDelimiter}${item.category}${itemUpdateTieBreakDelimiter}${item.deleted}`
}

export function registerListRoutes(app: FastifyInstance) {
  app.post('/v1/lists', async (request, reply) => {
    const body = listCreateSchema.parse(request.body)
    const tokenId = crypto.randomUUID()
    const querystring = listCreateQuerySchema.parse(request.query)
    const createdBy = normalizeDeviceId(querystring.deviceId)

    await withTransaction(async (client) => {
      await client.query(
        'INSERT INTO shared_lists(id, name, created_by_device_id, created_at, updated_at) VALUES ($1, $2, $3, NOW(), NOW())',
        [body.listId, body.name, createdBy],
      )
      await client.query(
        'INSERT INTO share_tokens(id, list_id, created_by_device_id, created_at) VALUES ($1, $2, $3, NOW())',
        [tokenId, body.listId, createdBy],
      )
    })

    reply.code(201)
    return { listId: body.listId, shareToken: tokenId }
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
      category: string
      deleted: boolean
      created_at: string
      updated_at: string
    }>(
      `SELECT id, text AS name, category, deleted, created_at, updated_at
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
      category: string
      deleted: boolean
      created_at: string
      updated_at: string
    }>(
      `SELECT id, text AS name, category, deleted, created_at, updated_at
         FROM list_items
        WHERE list_id = $1 AND updated_at > $2
        ORDER BY updated_at ASC, id ASC`,
      [request.auth!.listId, querystring.updatedAfter],
    )

    return {
      items: itemsResult.rows.map((item) => ({
        id: item.id,
        name: item.name,
        category: item.category,
        deleted: item.deleted,
        createdAt: item.created_at,
        updatedAt: item.updated_at,
      })),
    }
  })

  app.get('/v1/lists/:shareToken/items/:itemId', { preHandler: requireToken }, async (request, reply) => {
    const params = z.object({ itemId: z.string().min(1) }).parse(request.params)
    const itemResult = await query<{
      id: string
      name: string
      category: string
      deleted: boolean
      created_at: string
      updated_at: string
    }>(
      `SELECT id, text AS name, category, deleted, created_at, updated_at
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
          `INSERT INTO list_items(id, list_id, text, category, deleted, created_by_device_id, created_at, updated_at, deleted_at)
           VALUES ($1, $2, $3, $4, $5, $6, NOW(), $7, CASE WHEN $5 THEN NOW() ELSE NULL END)`,
          [params.itemId, request.auth!.listId, body.name, body.category, body.deleted, request.auth!.deviceId, body.updatedAt],
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
            SET text = $1,
                category = $2,
                deleted = $3,
                updated_at = $4,
                deleted_at = CASE WHEN $3 THEN NOW() ELSE NULL END
          WHERE id = $5
            AND list_id = $6
            AND (
              updated_at < $4
              OR (
                updated_at = $4
                AND CONCAT_WS($8, text, category, deleted::text) < $7
              )
            )`,
        [
          body.name,
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
