import crypto from 'node:crypto'

import { type FastifyInstance } from 'fastify'

import { generateShareToken, hashToken, normalizeDeviceId, requireToken } from '../auth.js'
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
    const shareToken = generateShareToken()
    const createdBy = normalizeDeviceId((request.query as { deviceId?: string } | undefined)?.deviceId)

    const result = await query<{ created_at: string }>(
      `INSERT INTO share_tokens(id, list_id, token_hash, created_by_device_id, created_at)
       VALUES ($1, $2, $3, $4, NOW())
       RETURNING created_at`,
      [tokenId, request.auth!.listId, hashToken(shareToken), createdBy]
    )

    const redeemedByResult = await query<{ device_id: string }>(
      `SELECT device_id
         FROM share_token_redemptions
        WHERE token_id = $1
        ORDER BY redeemed_at ASC`,
      [tokenId]
    )

    reply.code(201)
    return {
      tokenId,
      listId: request.auth!.listId,
      createdAt: result.rows[0].created_at,
      redeemedBy: redeemedByResult.rows.map((row) => row.device_id),
      shareToken
    }
  })
}
