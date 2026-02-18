import crypto from 'node:crypto'

import { type FastifyReply, type FastifyRequest } from 'fastify'
import { z } from 'zod'

import { query } from './db/client.js'

export type AuthContext = {
  listId: string
  deviceId: string
  tokenId?: string
  shareToken?: string
}

declare module 'fastify' {
  interface FastifyRequest {
    auth?: AuthContext
  }
}

const uuidSchema = z.uuid()
const deviceIdHeaderSchema = z.object({ 'x-device-id': z.uuid() })
const shareTokenParamsSchema = z.object({ shareToken: z.uuid() })
const listIdParamsSchema = z.object({ listId: z.uuid() })

export function normalizeDeviceId(value: unknown): string {
  return typeof value === 'string' && uuidSchema.safeParse(value).success
    ? value
    : crypto.randomUUID()
}

function getDeviceId(request: FastifyRequest): string | null {
  const parsedHeaders = deviceIdHeaderSchema.safeParse(request.headers)
  if (parsedHeaders.success) {
    return parsedHeaders.data['x-device-id']
  }

  return null
}

export async function requireListAccess(request: FastifyRequest, reply: FastifyReply) {
  const listIdParams = listIdParamsSchema.safeParse(request.params)
  const deviceId = getDeviceId(request)

  if (!listIdParams.success || !deviceId) {
    reply.code(400).send({ message: 'Invalid request' })
    return
  }

  const listId = listIdParams.data.listId
  const accessResult = await query<{ has_access: boolean }>(
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

  if (!accessResult.rows[0]?.has_access) {
    reply.code(403).send({ message: 'Forbidden' })
    return
  }

  request.auth = {
    listId,
    deviceId,
  }
}

export async function requireTokenForRedeem(request: FastifyRequest, reply: FastifyReply) {
  const shareTokenParams = shareTokenParamsSchema.safeParse(request.params)
  const deviceId = getDeviceId(request)

  if (!shareTokenParams.success || !deviceId) {
    reply.code(400).send({ message: 'Invalid request' })
    return
  }

  const shareToken = shareTokenParams.data.shareToken

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

  request.auth = {
    listId: tokenResult.rows[0].list_id,
    tokenId: tokenResult.rows[0].token_id,
    shareToken,
    deviceId,
  }
}
