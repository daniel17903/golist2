import crypto from 'node:crypto'

import Fastify, { type FastifyReply, type FastifyRequest } from 'fastify'
import { z } from 'zod'

import { query, withTransaction } from './db/client.js'

type AuthContext = {
  listId: string
  tokenId: string
  shareToken: string
}

declare module 'fastify' {
  interface FastifyRequest {
    auth?: AuthContext
  }
}

const uuidSchema = z.uuid()
const listCreateSchema = z.object({ name: z.string().min(1) })
const listNameUpdateSchema = z.object({ name: z.string().min(1) })
const itemCreateSchema = z.object({
  name: z.string().min(1),
  category: z.string().min(1),
  deleted: z.boolean()
})
const itemUpdateSchema = z.object({
  name: z.string().min(1),
  category: z.string().min(1),
  deleted: z.boolean(),
  updatedAt: z.iso.datetime()
})

function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex')
}

function generateShareToken(): string {
  return crypto.randomBytes(24).toString('hex')
}

function getBearerToken(request: FastifyRequest): string | null {
  const authHeader = request.headers.authorization
  if (!authHeader) {
    return null
  }

  const [scheme, token] = authHeader.split(' ')
  if (scheme !== 'Bearer' || !token) {
    return null
  }

  return token
}

function normalizeDeviceId(value: unknown): string {
  return typeof value === 'string' && uuidSchema.safeParse(value).success
    ? value
    : crypto.randomUUID()
}

async function requireToken(request: FastifyRequest, reply: FastifyReply) {
  const bearerToken = getBearerToken(request)
  const shareToken = (request.params as { shareToken?: string }).shareToken

  if (!bearerToken || !shareToken || bearerToken !== shareToken) {
    reply.code(401).send({ message: 'Unauthorized' })
    return
  }

  const tokenHash = hashToken(shareToken)
  const tokenResult = await query<{ token_id: string; list_id: string }>(
    `SELECT id AS token_id, list_id
       FROM share_tokens
      WHERE token_hash = $1
        AND revoked_at IS NULL
        AND (expires_at IS NULL OR expires_at > NOW())
      LIMIT 1`,
    [tokenHash]
  )

  if (!tokenResult.rowCount) {
    reply.code(401).send({ message: 'Unauthorized' })
    return
  }

  request.auth = {
    listId: tokenResult.rows[0].list_id,
    tokenId: tokenResult.rows[0].token_id,
    shareToken
  }
}

export function buildServer() {
  const app = Fastify({ logger: true })

  app.addHook('onRequest', async (request) => {
    request.log.info({ method: request.method, url: request.url }, 'request received')
  })

  app.addHook('onResponse', async (request, reply) => {
    request.log.info({ statusCode: reply.statusCode }, 'request completed')
  })

  app.setErrorHandler((error, _request, reply) => {
    if ((error as { issues?: unknown }).issues) {
      reply.status(400).send({ message: 'Invalid request' })
      return
    }

    reply.status(500).send({ message: 'Internal server error' })
  })

  app.get('/health', async () => ({ status: 'ok' as const }))

  app.post('/v1/lists', async (request, reply) => {
    const body = listCreateSchema.parse(request.body)
    const listId = crypto.randomUUID()
    const shareToken = generateShareToken()
    const tokenId = crypto.randomUUID()
    const createdBy = normalizeDeviceId((request.query as { deviceId?: string } | undefined)?.deviceId)

    await withTransaction(async (client) => {
      await client.query(
        'INSERT INTO shared_lists(id, name, created_by_device_id, created_at, updated_at) VALUES ($1, $2, $3, NOW(), NOW())',
        [listId, body.name, createdBy]
      )
      await client.query(
        'INSERT INTO share_tokens(id, list_id, token_hash, created_by_device_id, created_at) VALUES ($1, $2, $3, $4, NOW())',
        [tokenId, listId, hashToken(shareToken), createdBy]
      )
    })

    reply.code(201)
    return { listId, shareToken }
  })

  app.get('/v1/lists/:shareToken', { preHandler: requireToken }, async (request) => {
    const auth = request.auth!

    const listResult = await query<{
      id: string
      name: string
      created_at: string
      updated_at: string
      created_by_device_id: string
    }>('SELECT id, name, created_at, updated_at, created_by_device_id FROM shared_lists WHERE id = $1 LIMIT 1', [
      auth.listId
    ])

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
        ORDER BY created_at ASC`,
      [auth.listId]
    )

    const list = listResult.rows[0]

    return {
      listId: list.id,
      name: list.name,
      createdAt: list.created_at,
      updatedAt: list.updated_at,
      createdBy: list.created_by_device_id,
      items: itemsResult.rows.map((item) => ({
        id: item.id,
        name: item.name,
        category: item.category,
        deleted: item.deleted,
        createdAt: item.created_at,
        updatedAt: item.updated_at
      }))
    }
  })

  app.delete('/v1/lists/:shareToken', { preHandler: requireToken }, async (request, reply) => {
    await query('DELETE FROM shared_lists WHERE id = $1', [request.auth!.listId])
    reply.code(204)
  })

  app.patch('/v1/lists/:shareToken/name', { preHandler: requireToken }, async (request, reply) => {
    const body = listNameUpdateSchema.parse(request.body)
    await query('UPDATE shared_lists SET name = $1, updated_at = NOW() WHERE id = $2', [body.name, request.auth!.listId])
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
        ORDER BY updated_at ASC`,
      [request.auth!.listId, querystring.updatedAfter]
    )

    return {
      items: itemsResult.rows.map((item) => ({
        id: item.id,
        name: item.name,
        category: item.category,
        deleted: item.deleted,
        createdAt: item.created_at,
        updatedAt: item.updated_at
      }))
    }
  })

  app.post('/v1/lists/:shareToken/items', { preHandler: requireToken }, async (request, reply) => {
    const body = itemCreateSchema.parse(request.body)
    const itemId = crypto.randomUUID()
    const createdBy = normalizeDeviceId((request.query as { deviceId?: string } | undefined)?.deviceId)

    await query(
      `INSERT INTO list_items(id, list_id, text, category, position, deleted, created_by_device_id, created_at, updated_at, deleted_at)
       VALUES ($1, $2, $3, $4, COALESCE((SELECT MAX(position) + 1 FROM list_items WHERE list_id = $2), 0), $5, $6, NOW(), NOW(), CASE WHEN $5 THEN NOW() ELSE NULL END)`,
      [itemId, request.auth!.listId, body.name, body.category, body.deleted, createdBy]
    )

    reply.code(201)
    return { itemId }
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
      [params.itemId, request.auth!.listId]
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
      updatedAt: item.updated_at
    }
  })

  app.put('/v1/lists/:shareToken/items/:itemId', { preHandler: requireToken }, async (request, reply) => {
    const params = z.object({ itemId: z.string().min(1) }).parse(request.params)
    const body = itemUpdateSchema.parse(request.body)

    await query(
      `UPDATE list_items
          SET text = $1,
              category = $2,
              deleted = $3,
              updated_at = NOW(),
              deleted_at = CASE WHEN $3 THEN NOW() ELSE NULL END
        WHERE id = $4 AND list_id = $5`,
      [body.name, body.category, body.deleted, params.itemId, request.auth!.listId]
    )

    reply.code(204)
  })

  app.post('/v1/share-tokens/:shareToken/redeem', { preHandler: requireToken }, async (request, reply) => {
    const deviceId = normalizeDeviceId((request.query as { deviceId?: string } | undefined)?.deviceId)

    await query(
      `INSERT INTO share_token_redemptions(token_id, device_id, redeemed_at)
       VALUES ($1, $2, NOW())
       ON CONFLICT (token_id, device_id) DO NOTHING`,
      [request.auth!.tokenId, deviceId]
    )

    reply.code(204)
  })

  app.post('/v1/lists/:shareToken/share-tokens', { preHandler: requireToken }, async (request, reply) => {
    const tokenId = crypto.randomUUID()
    const shareToken = generateShareToken()
    const createdBy = normalizeDeviceId((request.query as { deviceId?: string } | undefined)?.deviceId)

    const result = await query<{ created_at: string }>(
      `INSERT INTO share_tokens(id, list_id, token_hash, created_by_device_id, created_at)
       VALUES ($1, $2, $3, $4, NOW())
       RETURNING created_at`,
      [tokenId, request.auth!.listId, hashToken(shareToken), createdBy]
    )

    reply.code(201)
    return {
      tokenId,
      listId: request.auth!.listId,
      createdAt: result.rows[0].created_at,
      redeemedBy: [],
      shareToken
    }
  })

  return app
}
