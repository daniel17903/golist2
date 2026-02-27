import Fastify from 'fastify'
import cors from '@fastify/cors'

import { registerErrorHandler } from './plugins/error-handler.js'
import { registerObservability } from './plugins/observability.js'
import { type ListRepository } from './repositories/list-repository.js'
import { postgresListRepository } from './repositories/postgres-list-repository.js'
import { registerHealthRoutes } from './routes/health.js'
import { registerListRoutes } from './routes/lists.js'
import { registerShareTokenRoutes } from './routes/share-tokens.js'
import { registerSyncWebsocketRoute } from './routes/sync-websocket.js'

export function buildServer(deps: { listRepository?: ListRepository } = {}) {
  const app = Fastify({ logger: true })
  const listRepository = deps.listRepository ?? postgresListRepository

  void app.register(cors, {
    origin: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'X-Device-Id'],
  })

  registerObservability(app)
  registerErrorHandler(app)
  registerHealthRoutes(app, listRepository)
  registerListRoutes(app, listRepository)
  registerShareTokenRoutes(app, listRepository)
  void registerSyncWebsocketRoute(app, listRepository)

  return app
}

const server = buildServer()

export default server
