import { type FastifyInstance } from 'fastify'

export function registerObservability(app: FastifyInstance) {
  app.addHook('onReady', async () => {
    app.log.info(
      {
        nodeEnv: process.env.NODE_ENV,
        routes: app.printRoutes(),
      },
      'server boot completed',
    )
  })

  app.addHook('onRequest', async (request) => {
    request.log.info(
      {
        requestId: request.id,
        method: request.method,
        url: request.url,
        hostname: request.hostname,
        userAgent: request.headers['user-agent'],
      },
      'request received',
    )
  })

  app.addHook('onResponse', async (request, reply) => {
    request.log.info(
      {
        requestId: request.id,
        method: request.method,
        url: request.url,
        statusCode: reply.statusCode,
      },
      'request completed',
    )
  })

  app.addHook('onError', async (request, reply, error) => {
    request.log.error(
      {
        requestId: request.id,
        method: request.method,
        url: request.url,
        statusCode: reply.statusCode,
        errorMessage: error.message,
        errorStack: error.stack,
      },
      'request failed',
    )
  })
}
