import { type FastifyInstance } from 'fastify'

// Per-request logging (incoming request / request completed with
// responseTime) is already provided by Fastify's built-in `logger: true`
// (see server.ts), so this plugin is intentionally limited to boot-time
// observability only. Do not re-add onRequest/onResponse hooks here — that
// would duplicate the built-in logging. Error logging is handled exactly
// once, in plugins/error-handler.ts's setErrorHandler.
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
}
