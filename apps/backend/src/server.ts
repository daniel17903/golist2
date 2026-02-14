import Fastify from 'fastify'

import { registerErrorHandler } from './plugins/error-handler.js'
import { registerObservability } from './plugins/observability.js'
import { registerHealthRoutes } from './routes/health.js'
import { registerListRoutes } from './routes/lists.js'
import { registerShareTokenRoutes } from './routes/share-tokens.js'

export function buildServer() {
  const app = Fastify({ logger: true })

  registerObservability(app)
  registerErrorHandler(app)
  registerHealthRoutes(app)
  registerListRoutes(app)
  registerShareTokenRoutes(app)

  return app
}
