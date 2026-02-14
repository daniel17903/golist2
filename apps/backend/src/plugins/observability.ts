import { type FastifyInstance } from 'fastify'

export function registerObservability(app: FastifyInstance) {
  app.addHook('onRequest', async (request) => {
    request.log.info({ method: request.method, url: request.url }, 'request received')
  })

  app.addHook('onResponse', async (request, reply) => {
    request.log.info({ statusCode: reply.statusCode }, 'request completed')
  })
}
