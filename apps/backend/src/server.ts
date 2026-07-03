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
// Matches any localhost/127.0.0.1 origin regardless of port: the web app's
// Vite dev server (5173), its preview server used by the Playwright E2E
// suite (4173), and any other local port a developer runs it on.
const LOCAL_DEV_ORIGIN_PATTERN = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/

function isAllowedOrigin(origin: string): boolean {
  if (origin === PRODUCTION_ORIGIN) {
    return true
  }

  return env.NODE_ENV !== 'production' && LOCAL_DEV_ORIGIN_PATTERN.test(origin)
}

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
    origin: (origin, callback) => {
      // No Origin header (e.g. same-origin requests, curl) — allow, matching
      // the prior @fastify/cors default behavior for non-browser callers.
      if (!origin || isAllowedOrigin(origin)) {
        callback(null, true)
        return
      }

      callback(new Error('Not allowed by CORS'), false)
    },
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
