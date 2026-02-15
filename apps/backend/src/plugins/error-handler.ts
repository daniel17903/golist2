import { type FastifyInstance } from 'fastify'

const hasIssues = (value: unknown): boolean => {
  if (typeof value !== 'object' || value === null) {
    return false
  }

  return Reflect.has(value, 'issues')
}

export function registerErrorHandler(app: FastifyInstance) {
  app.setErrorHandler((error, request, reply) => {
    request.log.error(
      {
        requestId: request.id,
        method: request.method,
        url: request.url,
        errorMessage: error.message,
        errorStack: error.stack,
      },
      'error handler captured an exception',
    )

    if (hasIssues(error)) {
      reply.status(400).send({ message: 'Invalid request' })
      return
    }

    reply.status(500).send({ message: 'Internal server error' })
  })
}
