import { type FastifyInstance } from 'fastify'
import { z } from 'zod'

import { type RealtimeHub } from '../realtime-hub.js'
import { createAuthGuards } from '../auth.js'
import { type ListRepository } from '../repositories/list-repository.js'

const listIdParamsSchema = z.object({ listId: z.uuid() })

export function registerRealtimeRoutes(app: FastifyInstance, listRepository: ListRepository, realtimeHub: RealtimeHub) {
  const { requireListAccess } = createAuthGuards(listRepository)

  app.get('/v1/lists/:listId/realtime', { websocket: true, preHandler: requireListAccess }, (connection, request) => {
    const params = listIdParamsSchema.parse(request.params)
    const auth = request.auth

    if (!auth) {
      connection.socket.close(1008, 'Unauthorized')
      return
    }

    realtimeHub.addConnection({
      listId: params.listId,
      deviceId: auth.deviceId,
      socket: connection.socket,
    })
  })
}
