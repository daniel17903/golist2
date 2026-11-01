import { createMcpHandler } from '@modelcontextprotocol/server'
import { type FastifyInstance } from 'fastify'
import { z } from 'zod'

import { hashConnectorKey } from '../mcp/connector-key.js'
import { buildMcpServer, type McpToolDeps } from '../mcp/tools.js'

const paramsSchema = z.object({ key: z.string().min(1).max(200) })
const connectorDeviceSchema = z.object({ connectorDeviceId: z.uuid() })

/**
 * The MCP endpoint AI assistants connect to. The secret key in the path is
 * the credential (a "no auth" connector from the assistant's point of view):
 * it resolves to a connector, and the tools act as that connector's device.
 * Stateless: every request gets a fresh server instance, so GET/DELETE (2025
 * session operations) are answered with 405 by the SDK.
 */
export function registerMcpRoutes(app: FastifyInstance, deps: McpToolDeps) {
  const handler = createMcpHandler(
    (context) => {
      const { connectorDeviceId } = connectorDeviceSchema.parse(context.authInfo?.extra)
      return buildMcpServer(connectorDeviceId, deps)
    },
    {
      legacy: 'stateless',
      onerror: (error) => app.log.warn({ err: error }, 'mcp request failed'),
    },
  )
  app.addHook('onClose', async () => {
    await handler.close()
  })

  app.route({
    method: ['GET', 'POST', 'DELETE'],
    url: '/v1/mcp/:key',
    handler: async (request, reply) => {
      const { key } = paramsSchema.parse(request.params)
      const connector = await deps.listRepository.findConnectorByKeyHash(hashConnectorKey(key))
      if (!connector) {
        reply.code(404)
        return { message: 'Unknown connector' }
      }
      await deps.listRepository.markConnectorUsed(connector.id)

      const headers = new Headers()
      for (const [name, value] of Object.entries(request.headers)) {
        for (const entry of [value ?? []].flat()) {
          headers.append(name, entry)
        }
      }
      const hasBody = request.method === 'POST' && request.body !== undefined
      const response = await handler.fetch(
        new Request(new URL(request.url, `${request.protocol}://${request.host}`), {
          method: request.method,
          headers,
          body: hasBody ? JSON.stringify(request.body) : undefined,
        }),
        {
          ...(hasBody ? { parsedBody: request.body } : {}),
          authInfo: { token: 'connector-key', clientId: connector.id, scopes: [], extra: { connectorDeviceId: connector.deviceId } },
        },
      )

      reply.code(response.status)
      response.headers.forEach((value, name) => {
        reply.header(name, value)
      })
      return reply.send(response.body)
    },
  })
}
