import { type FastifyInstance } from 'fastify'

const ipv4Any = '0.0.0.0'
const dualStackAny = '::'

/**
 * Listens on `host`. `0.0.0.0` (the default, "all interfaces") binds the
 * dual-stack wildcard `::` instead, so the server answers on IPv6 too: the
 * deployment health check runs `wget http://localhost:3000/healthz` inside the
 * Alpine image, where `localhost` resolves to `::1` first, and an IPv4-only
 * bind refuses that connection (every rollout was reported unhealthy). Hosts
 * without IPv6 cannot bind `::`; there it falls back to `0.0.0.0`.
 */
export async function listenOnHost(server: FastifyInstance, host: string, port: number): Promise<string> {
  if (host !== ipv4Any) {
    await server.listen({ host, port })
    return host
  }

  try {
    await server.listen({ host: dualStackAny, port, ipv6Only: false })
    return dualStackAny
  } catch (error) {
    const code = error instanceof Error ? Reflect.get(error, 'code') : undefined
    if (code !== 'EAFNOSUPPORT' && code !== 'EADDRNOTAVAIL') {
      throw error
    }
    server.log.warn({ code }, 'IPv6 unavailable, listening on IPv4 only')
    await server.listen({ host: ipv4Any, port })
    return ipv4Any
  }
}
