import crypto from 'node:crypto'

import { type FastifyReply, type FastifyRequest } from 'fastify'
import { z } from 'zod'

import { query } from './db/client.js'

export type AuthContext = {
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

export async function requireToken(request: FastifyRequest, reply: FastifyReply) {
  const bearerToken = getBearerToken(request)
  const shareToken = (request.params as { shareToken?: string }).shareToken

  if (!bearerToken || !shareToken || bearerToken !== shareToken) {
    reply.code(401).send({ message: 'Unauthorized' })
    return
  }

  const tokenResult = await query<{ token_id: string; list_id: string }>(
    `SELECT id AS token_id, list_id
       FROM share_tokens
      WHERE id = $1
        AND revoked_at IS NULL
        AND (expires_at IS NULL OR expires_at > NOW())
      LIMIT 1`,
    [shareToken]
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
