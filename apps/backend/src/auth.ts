import crypto from 'node:crypto'

import { type FastifyReply, type FastifyRequest } from 'fastify'
import { z } from 'zod'

import { query } from './db/client.js'
import { hasListAccess } from './access.js'

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
  if (!(await hasListAccess(listId, deviceId))) {
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
