import { env } from './config/env.js'
import { buildServer } from './server.js'

const server = buildServer()

async function start() {
  try {
    await server.listen({ host: env.HOST, port: env.PORT })
  } catch (error) {
    server.log.error(error)
    process.exit(1)
  }
}

void start()
