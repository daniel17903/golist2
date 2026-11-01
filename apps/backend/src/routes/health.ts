import { type FastifyInstance, type FastifyReply, type FastifyRequest } from 'fastify'

import { type ListRepository } from '../repositories/list-repository.js'

export function registerHealthRoutes(app: FastifyInstance, listRepository: ListRepository) {
  const healthCheck = async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      await listRepository.ping()
      return { status: 'ok' as const }
    } catch (error) {
      request.log.error({ error }, 'health check database query failed')
      reply.status(503)
      return { status: 'error' as const }
    }
  }

  app.get('/health', healthCheck)
  // The deployment (Coolify) health check probes /healthz; without it every
  // new container is reported unhealthy and the rollout is rolled back.
  app.get('/healthz', healthCheck)
}
