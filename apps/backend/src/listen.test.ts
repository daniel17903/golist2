import net from 'node:net'

import Fastify from 'fastify'
import { afterEach, describe, expect, it } from 'vitest'

import { listenOnHost } from './listen.js'

const ipv6Available = await new Promise<boolean>((resolve) => {
  const probe = net.createServer()
  probe.once('error', () => resolve(false))
  probe.listen({ host: '::1', port: 0 }, () => probe.close(() => resolve(true)))
})

const get = async (host: string, port: number) => (await fetch(`http://${host}:${port}/healthz`)).status

let app: ReturnType<typeof Fastify> | undefined
afterEach(async () => {
  await app?.close()
  app = undefined
})

describe('listenOnHost', () => {
  it('answers on IPv4 and, where the host has IPv6, on ::1 for the "all interfaces" host', async () => {
    app = Fastify()
    app.get('/healthz', async () => ({ status: 'ok' }))

    const bound = await listenOnHost(app, '0.0.0.0', 0)
    const address = app.server.address()
    const port = typeof address === 'object' && address ? address.port : 0

    expect(await get('127.0.0.1', port)).toBe(200)
    if (ipv6Available) {
      // The deployment health check's `localhost` resolves to ::1 first.
      expect(bound).toBe('::')
      expect(await get('[::1]', port)).toBe(200)
    } else {
      expect(bound).toBe('0.0.0.0')
    }
  })

  it('binds any other host as given', async () => {
    app = Fastify()
    expect(await listenOnHost(app, '127.0.0.1', 0)).toBe('127.0.0.1')
  })
})
