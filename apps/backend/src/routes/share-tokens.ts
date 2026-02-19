import crypto from 'node:crypto'

import { type FastifyInstance } from 'fastify'
import { z } from 'zod'

import { requireTokenForRedeem } from '../auth.js'
import { query } from '../db/client.js'
import { hasListAccess } from '../access.js'

const listIdParamsSchema = z.object({ listId: z.uuid() })
const deviceHeaderSchema = z.object({ 'x-device-id': z.uuid() })

export function registerShareTokenRoutes(app: FastifyInstance) {
  app.post('/v1/share-tokens/:shareToken/redeem', { preHandler: requireTokenForRedeem }, async (request, reply) => {
    const deviceId = request.auth!.deviceId

    await query(
      `INSERT INTO share_token_redemptions(token_id, device_id, redeemed_at)
       VALUES ($1, $2, NOW())
       ON CONFLICT (token_id, device_id) DO NOTHING`,
      [request.auth!.tokenId, deviceId],
    )

    reply.code(200)
    return { listId: request.auth!.listId }
  })

  app.post('/v1/lists/:listId/share-tokens', async (request, reply) => {
    const { listId } = listIdParamsSchema.parse(request.params)
    const headers = deviceHeaderSchema.parse(request.headers)
    const deviceId = headers['x-device-id']

    if (!(await hasListAccess(listId, deviceId))) {
      reply.code(403)
      return { message: 'Forbidden' }
    }

    const tokenId = crypto.randomUUID()

    const result = await query<{ created_at: string }>(
      `INSERT INTO share_tokens(id, list_id, created_by_device_id, created_at)
       VALUES ($1, $2, $3, NOW())
       RETURNING created_at`,
      [tokenId, listId, deviceId],
    )

    await query(
      `INSERT INTO share_token_redemptions(token_id, device_id, redeemed_at)
       VALUES ($1, $2, NOW())
       ON CONFLICT (token_id, device_id) DO NOTHING`,
      [tokenId, deviceId],
    )

    reply.code(201)
    return {
      tokenId,
      listId,
      createdAt: result.rows[0].created_at,
      shareToken: tokenId,
    }
  })
}
