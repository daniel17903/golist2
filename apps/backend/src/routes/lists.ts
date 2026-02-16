import crypto from 'node:crypto'

import { type FastifyInstance } from 'fastify'
import { z } from 'zod'

import { normalizeDeviceId, requireToken } from '../auth.js'
import { query, withTransaction } from '../db/client.js'

const listCreateSchema = z.object({ name: z.string().min(1) })
const listNameUpdateSchema = z.object({ name: z.string().min(1) })
const itemCreateSchema = z.object({
  name: z.string().min(1),
  category: z.string().min(1),
  deleted: z.boolean(),
})
const listCreateQuerySchema = z.object({ deviceId: z.uuid().optional() })
const itemUpdateSchema = z.object({
  name: z.string().min(1),
  category: z.string().min(1),
  deleted: z.boolean(),
  updatedAt: z.iso.datetime(),
})

const idempotencyHeadersSchema = z.object({
  'idempotency-key': z.string().trim().min(1).max(200).optional(),
})

const itemUpdateTieBreakDelimiter = '\u0001'

function computeRequestHash(payload: unknown): string {
  return crypto.createHash('sha256').update(JSON.stringify(payload)).digest('hex')
}

function computeItemTieBreakValue(item: { name: string; category: string; deleted: boolean }): string {
  return `${item.name}${itemUpdateTieBreakDelimiter}${item.category}${itemUpdateTieBreakDelimiter}${item.deleted}`
}

export function registerListRoutes(app: FastifyInstance) {
  app.post('/v1/lists', async (request, reply) => {
    const body = listCreateSchema.parse(request.body)
    const listId = crypto.randomUUID()
    const tokenId = crypto.randomUUID()
    const querystring = listCreateQuerySchema.parse(request.query)
    const createdBy = normalizeDeviceId(querystring.deviceId)

    await withTransaction(async (client) => {
      await client.query(
        'INSERT INTO shared_lists(id, name, created_by_device_id, created_at, updated_at) VALUES ($1, $2, $3, NOW(), NOW())',
        [listId, body.name, createdBy],
      )
      await client.query(
        'INSERT INTO share_tokens(id, list_id, created_by_device_id, created_at) VALUES ($1, $2, $3, NOW())',
        [tokenId, listId, createdBy],
      )
    })

    reply.code(201)
    return { listId, shareToken: tokenId }
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

  app.post('/v1/lists/:shareToken/items', { preHandler: requireToken }, async (request, reply) => {
    const body = itemCreateSchema.parse(request.body)
    const createdBy = request.auth!.deviceId
    const idempotencyHeaders = idempotencyHeadersSchema.parse(request.headers)
    const idempotencyKey = idempotencyHeaders['idempotency-key']

    if (!idempotencyKey) {
      const itemId = crypto.randomUUID()

      await withTransaction(async (client) => {
        await client.query('SELECT id FROM shared_lists WHERE id = $1 FOR UPDATE', [request.auth!.listId])
        await client.query(
          `INSERT INTO list_items(id, list_id, text, category, deleted, created_by_device_id, created_at, updated_at, deleted_at)
           VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW(), CASE WHEN $5 THEN NOW() ELSE NULL END)`,
          [itemId, request.auth!.listId, body.name, body.category, body.deleted, createdBy],
        )
        await client.query('UPDATE shared_lists SET updated_at = NOW() WHERE id = $1', [request.auth!.listId])
      })

      reply.code(201)
      return { itemId }
    }

    const requestHash = computeRequestHash(body)

    const result = await withTransaction(async (client) => {
      await client.query('SELECT id FROM shared_lists WHERE id = $1 FOR UPDATE', [request.auth!.listId])

      const existingIdempotencyRecord = await client.query<{ response_code: number; response_body: { itemId: string }; request_hash: string }>(
        `SELECT response_code, response_body, request_hash
           FROM idempotency_keys
          WHERE token_id = $1
            AND device_id = $2
            AND route = $3
            AND idempotency_key = $4
          FOR UPDATE`,
        [request.auth!.tokenId, request.auth!.deviceId, '/v1/lists/:shareToken/items', idempotencyKey],
      )

      if (existingIdempotencyRecord.rowCount) {
        const [record] = existingIdempotencyRecord.rows

        if (record.request_hash !== requestHash) {
          return {
            statusCode: 409,
            payload: { message: 'Idempotency key reuse with different payload is not allowed' },
          }
        }

        return {
          statusCode: record.response_code,
          payload: record.response_body,
        }
      }

      const itemId = crypto.randomUUID()

      await client.query(
        `INSERT INTO list_items(id, list_id, text, category, deleted, created_by_device_id, created_at, updated_at, deleted_at)
         VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW(), CASE WHEN $5 THEN NOW() ELSE NULL END)`,
        [itemId, request.auth!.listId, body.name, body.category, body.deleted, createdBy],
      )

      await client.query('UPDATE shared_lists SET updated_at = NOW() WHERE id = $1', [request.auth!.listId])

      const payload = { itemId }

      await client.query(
        `INSERT INTO idempotency_keys(token_id, device_id, route, idempotency_key, request_hash, response_code, response_body, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, NOW())`,
        [
          request.auth!.tokenId,
          request.auth!.deviceId,
          '/v1/lists/:shareToken/items',
          idempotencyKey,
          requestHash,
          201,
          JSON.stringify(payload),
        ],
      )

      return {
        statusCode: 201,
        payload,
      }
    })

    reply.code(result.statusCode)
    return result.payload
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
    const params = z.object({ itemId: z.string().min(1) }).parse(request.params)
    const body = itemUpdateSchema.parse(request.body)
    const tieBreakValue = computeItemTieBreakValue(body)

    await withTransaction(async (client) => {
      await client.query('SELECT id FROM shared_lists WHERE id = $1 FOR UPDATE', [request.auth!.listId])

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
        [body.name, body.category, body.deleted, body.updatedAt, params.itemId, request.auth!.listId, tieBreakValue, itemUpdateTieBreakDelimiter],
      )

      if (updateResult.rowCount) {
        await client.query('UPDATE shared_lists SET updated_at = GREATEST(updated_at, $2::timestamptz) WHERE id = $1', [
          request.auth!.listId,
          body.updatedAt,
        ])
      }
    })

    reply.code(204)
  })
}
