import { type FastifyInstance } from 'fastify'

import { query } from '../db/client.js'

export function registerHealthRoutes(app: FastifyInstance) {
  app.get('/health', async (request, reply) => {
    try {
      await query('SELECT 1')
      return { status: 'ok' as const }
    } catch (error) {
      request.log.error({ error }, 'health check database query failed')
      reply.status(503)
      return { status: 'error' as const }
    }
  })
}
