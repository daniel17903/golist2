import { type FastifyInstance } from 'fastify'
import { z } from 'zod'

import { createAuthGuards } from '../auth.js'
import { type ListRepository } from '../repositories/list-repository.js'

const listIdParamsSchema = z.object({ listId: z.uuid() })
const deviceHeaderSchema = z.object({ 'x-device-id': z.uuid() })

export function registerShareTokenRoutes(app: FastifyInstance, listRepository: ListRepository) {
  const { requireTokenForRedeem } = createAuthGuards(listRepository)

  app.post('/v1/share-tokens/:shareToken/redeem', { preHandler: requireTokenForRedeem }, async (request, reply) => {
    const deviceId = request.auth!.deviceId
    await listRepository.recordShareTokenRedemption(request.auth!.tokenId!, deviceId)

    reply.code(200)
    return { listId: request.auth!.listId }
  })

  app.post('/v1/lists/:listId/share-tokens', async (request, reply) => {
    const { listId } = listIdParamsSchema.parse(request.params)
    const headers = deviceHeaderSchema.parse(request.headers)
    const deviceId = headers['x-device-id']

    if (!(await listRepository.hasListAccess(listId, deviceId))) {
      reply.code(403)
      return { message: 'Forbidden' }
    }

    const token = await listRepository.createShareToken(listId, deviceId)
    await listRepository.recordShareTokenRedemption(token.tokenId, deviceId)

    reply.code(201)
    return {
      tokenId: token.tokenId,
      listId,
      createdAt: token.createdAt,
      shareToken: token.tokenId,
    }
  })
}
