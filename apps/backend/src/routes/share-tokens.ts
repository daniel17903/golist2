import crypto from 'node:crypto'

import { type FastifyInstance } from 'fastify'

import { normalizeDeviceId, requireToken } from '../auth.js'
import { query } from '../db/client.js'

export function registerShareTokenRoutes(app: FastifyInstance) {
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
    const createdBy = normalizeDeviceId((request.query as { deviceId?: string } | undefined)?.deviceId)

    const result = await query<{ created_at: string }>(
      `INSERT INTO share_tokens(id, list_id, created_by_device_id, created_at)
       VALUES ($1, $2, $3, NOW())
       RETURNING created_at`,
      [tokenId, request.auth!.listId, createdBy]
    )

    reply.code(201)
    return {
      tokenId,
      listId: request.auth!.listId,
      createdAt: result.rows[0].created_at,
      shareToken: tokenId
    }
  })
}
