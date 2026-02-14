import Fastify from 'fastify'

export function buildServer() {
  const app = Fastify({ logger: true })

  app.get('/health', async () => ({ status: 'ok' as const }))

  return app
}
