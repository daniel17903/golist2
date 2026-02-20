import { type FastifyInstance } from 'fastify'

const hasIssues = (value: unknown): boolean => {
  if (typeof value !== 'object' || value === null) {
    return false
  }

  return Reflect.has(value, 'issues')
}

export function registerErrorHandler(app: FastifyInstance) {
  app.setErrorHandler((error, request, reply) => {
    const errorMessage = error instanceof Error ? error.message : String(error)
    const errorStack = error instanceof Error ? error.stack : undefined

    request.log.error(
      {
        requestId: request.id,
        method: request.method,
        url: request.url,
        errorMessage,
        errorStack,
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
