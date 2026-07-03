import Fastify, { type FastifyRequest } from 'fastify'
import cors from '@fastify/cors'

import { env } from './config/env.js'
import { redactShareTokenUrl } from './lib/redact-url.js'
import { registerErrorHandler } from './plugins/error-handler.js'
import { registerObservability } from './plugins/observability.js'
import { type ListRepository } from './repositories/list-repository.js'
import { postgresListRepository } from './repositories/postgres-list-repository.js'
import { registerHealthRoutes } from './routes/health.js'
import { registerListRoutes } from './routes/lists.js'
import { registerShareTokenRoutes } from './routes/share-tokens.js'
import { registerSyncWebsocketRoute } from './routes/sync-websocket.js'
import { ListSyncCache } from './sync/list-sync-cache.js'

const PRODUCTION_ORIGIN = 'https://go-list.app'
const LOCAL_DEV_ORIGIN = 'http://localhost:5173'

const allowedOrigins =
  env.NODE_ENV === 'production' ? [PRODUCTION_ORIGIN] : [PRODUCTION_ORIGIN, LOCAL_DEV_ORIGIN]

export function buildServer(deps: { listRepository?: ListRepository } = {}) {
  const app = Fastify({
    logger: {
      // Fastify's built-in logger already logs "incoming request"/"request
      // completed" (with responseTime) for every request, so we rely on it
      // as the single source of request logging instead of duplicating it
      // in a custom hook (see plugins/observability.ts). The req serializer
      // is overridden only to redact share tokens, which travel in the URL
      // path, out of the logged `url` field.
      serializers: {
        req(request: FastifyRequest) {
          return {
            method: request.method,
            url: redactShareTokenUrl(request.url),
            hostname: request.hostname,
            remoteAddress: request.ip,
            remotePort: request.socket?.remotePort,
          }
        },
      },
    },
  })
  const listRepository = deps.listRepository ?? postgresListRepository
  // Shared between the REST list/item routes and the WebSocket sync route so
  // that a write made over either transport invalidates the same cached
  // digest/summaries snapshot (see sync/list-sync-cache.ts).
  const listSyncCache = new ListSyncCache()

  void app.register(cors, {
    origin: allowedOrigins,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'X-Device-Id'],
  })

  registerObservability(app)
  registerErrorHandler(app)
  registerHealthRoutes(app, listRepository)
  registerListRoutes(app, listRepository, listSyncCache)
  registerShareTokenRoutes(app, listRepository)
  void registerSyncWebsocketRoute(app, listRepository, listSyncCache)

  return app
}
