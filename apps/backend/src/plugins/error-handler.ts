import { type FastifyInstance } from 'fastify'

export function registerErrorHandler(app: FastifyInstance) {
  app.setErrorHandler((error, _request, reply) => {
    if ((error as { issues?: unknown }).issues) {
      reply.status(400).send({ message: 'Invalid request' })
      return
    }

    reply.status(500).send({ message: 'Internal server error' })
  })
}
