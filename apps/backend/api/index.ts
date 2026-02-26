import { type IncomingMessage, type ServerResponse } from 'node:http'

import { buildServer } from '../src/server.js'

const app = buildServer()

let readyPromise: Promise<void> | undefined

async function ensureServerReady() {
  if (!readyPromise) {
    readyPromise = Promise.resolve(app.ready()).then(() => {
      app.log.info('serverless function initialized Fastify runtime')
    })
  }

  await readyPromise
}

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  try {
    await ensureServerReady()
    app.server.emit('request', req, res)
  } catch (error) {
    console.error('[serverless] failed to handle request via Fastify runtime', error)

    if (!res.headersSent) {
      res.statusCode = 500
      res.setHeader('content-type', 'application/json')
      res.end(JSON.stringify({ message: 'Internal server error' }))
    }
  }
}
