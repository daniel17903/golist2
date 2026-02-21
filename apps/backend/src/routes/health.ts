import { type FastifyInstance } from 'fastify'

import { type ListRepository } from '../repositories/list-repository.js'

export function registerHealthRoutes(app: FastifyInstance, listRepository: ListRepository) {
  app.get('/health', async (request, reply) => {
    try {
      await listRepository.ping()
      return { status: 'ok' as const }
    } catch (error) {
      request.log.error({ error }, 'health check database query failed')
      reply.status(503)
      return { status: 'error' as const }
    }
  })
}
