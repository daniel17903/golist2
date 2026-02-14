import crypto from 'node:crypto'

import { type FastifyReply, type FastifyRequest } from 'fastify'
import { z } from 'zod'

import { query } from './db/client.js'

export type AuthContext = {
  listId: string
  tokenId: string
  shareToken: string
  deviceId: string
}

declare module 'fastify' {
  interface FastifyRequest {
    auth?: AuthContext
  }
}

const uuidSchema = z.uuid()
const authQuerySchema = z.object({ deviceId: z.uuid() })
const shareTokenParamsSchema = z.object({ shareToken: z.string().min(1) })

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

export function normalizeDeviceId(value: unknown): string {
  return typeof value === 'string' && uuidSchema.safeParse(value).success
    ? value
    : crypto.randomUUID()
}

async function requireTokenInternal(
  request: FastifyRequest,
  reply: FastifyReply,
  requireRedeemedAccess: boolean,
) {
  const bearerToken = getBearerToken(request)
  const params = shareTokenParamsSchema.safeParse(request.params)
  const shareToken = params.success ? params.data.shareToken : null

  if (!bearerToken || !shareToken || bearerToken !== shareToken) {
    reply.code(401).send({ message: 'Unauthorized' })
    return
  }

  const querystring = authQuerySchema.safeParse(request.query)

  if (!querystring.success) {
    reply.code(400).send({ message: 'Invalid request' })
    return
  }

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
    reply.code(401).send({ message: 'Unauthorized' })
    return
  }

  if (requireRedeemedAccess) {
    const redeemedResult = await query(
      `SELECT 1
         FROM share_token_redemptions
        WHERE token_id = $1 AND device_id = $2
        LIMIT 1`,
      [tokenResult.rows[0].token_id, querystring.data.deviceId],
    )

    if (!redeemedResult.rowCount) {
      reply.code(403).send({ message: 'Forbidden' })
      return
    }
  }

  request.auth = {
    listId: tokenResult.rows[0].list_id,
    tokenId: tokenResult.rows[0].token_id,
    shareToken,
    deviceId: querystring.data.deviceId,
  }
}

export async function requireToken(request: FastifyRequest, reply: FastifyReply) {
  await requireTokenInternal(request, reply, true)
}

export async function requireTokenForRedeem(request: FastifyRequest, reply: FastifyReply) {
  await requireTokenInternal(request, reply, false)
}
