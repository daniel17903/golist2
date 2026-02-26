import { env } from './config/env.js'
import { buildServer } from './server.js'

const server = buildServer()

async function start() {
  server.log.info(
    {
      host: env.HOST,
      port: env.PORT,
      nodeEnv: env.NODE_ENV,
    },
    'starting backend server',
  )

  try {
    await server.listen({ host: env.HOST, port: env.PORT })

    server.log.info(
      {
        host: env.HOST,
        port: env.PORT,
      },
      'backend server is listening',
    )
  } catch (error) {
    server.log.error(error, 'backend server failed to start')
    process.exit(1)
  }
}

void start()
