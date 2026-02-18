import crypto from 'node:crypto'

import { type FastifyInstance } from 'fastify'
import { z } from 'zod'

import { requireTokenForRedeem } from '../auth.js'
import { query } from '../db/client.js'

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

    const listAccessResult = await query<{ has_access: boolean }>(
      `SELECT EXISTS(
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
       ) AS has_access`,
      [listId, deviceId],
    )

    if (!listAccessResult.rows[0]?.has_access) {
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
