import crypto from 'node:crypto'

import { type FastifyReply, type FastifyRequest } from 'fastify'
import { z } from 'zod'

import { type ListRepository } from './repositories/list-repository.js'

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

export function createAuthGuards(listRepository: ListRepository) {
  async function requireListAccess(request: FastifyRequest, reply: FastifyReply) {
    const listIdParams = listIdParamsSchema.safeParse(request.params)
    const deviceId = getDeviceId(request)

    if (!listIdParams.success || !deviceId) {
      reply.code(400).send({ message: 'Invalid request' })
      return
    }

    const listId = listIdParams.data.listId
    if (!(await listRepository.hasListAccess(listId, deviceId))) {
      reply.code(403).send({ message: 'Forbidden' })
      return
    }

    request.auth = {
      listId,
      deviceId,
    }
  }

  async function requireTokenForRedeem(request: FastifyRequest, reply: FastifyReply) {
    const shareTokenParams = shareTokenParamsSchema.safeParse(request.params)
    const deviceId = getDeviceId(request)

    if (!shareTokenParams.success || !deviceId) {
      reply.code(400).send({ message: 'Invalid request' })
      return
    }

    const shareToken = shareTokenParams.data.shareToken
    const token = await listRepository.findValidShareToken(shareToken)

    if (!token) {
      reply.code(401).send({ message: 'Unauthorized' })
      return
    }

    request.auth = {
      listId: token.listId,
      tokenId: token.tokenId,
      shareToken,
      deviceId,
    }
  }

  return {
    requireListAccess,
    requireTokenForRedeem,
  }
}
