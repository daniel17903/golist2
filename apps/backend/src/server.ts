import Fastify from 'fastify'
import cors from '@fastify/cors'
import websocket from '@fastify/websocket'

import { registerErrorHandler } from './plugins/error-handler.js'
import { registerObservability } from './plugins/observability.js'
import { type ListRepository } from './repositories/list-repository.js'
import { postgresListRepository } from './repositories/postgres-list-repository.js'
import { registerHealthRoutes } from './routes/health.js'
import { registerListRoutes } from './routes/lists.js'
import { registerRealtimeRoutes } from './routes/realtime.js'
import { registerShareTokenRoutes } from './routes/share-tokens.js'
import { createRealtimeHub } from './realtime-hub.js'

export function buildServer(deps: { listRepository?: ListRepository } = {}) {
  const app = Fastify({ logger: true })
  const listRepository = deps.listRepository ?? postgresListRepository
  const realtimeHub = createRealtimeHub()

  void app.register(cors, {
    origin: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'X-Device-Id'],
  })
  void app.register(websocket)

  registerObservability(app)
  registerErrorHandler(app)
  registerHealthRoutes(app, listRepository)
  registerListRoutes(app, listRepository, realtimeHub)
  registerRealtimeRoutes(app, listRepository, realtimeHub)
  registerShareTokenRoutes(app, listRepository)

  return app
}

const server = buildServer()

export default server
