import { type FastifyInstance } from 'fastify'
import { z } from 'zod'

import { generateConnectorKey, hashConnectorKey } from '../mcp/connector-key.js'
import { type ConnectorRecord, type ListRepository } from '../repositories/list-repository.js'

const deviceHeaderSchema = z.object({ 'x-device-id': z.uuid() })
const connectorParamsSchema = z.object({ connectorId: z.uuid() })
const connectorBodySchema = z.object({
  label: z.string().trim().min(1).max(60),
  includeAllLists: z.boolean(),
  listIds: z.array(z.uuid()).max(500).default([]),
})

const toConnectorResponse = (connector: ConnectorRecord) => ({
  connectorId: connector.id,
  label: connector.label,
  includeAllLists: connector.includeAllLists,
  listIds: connector.listIds,
  createdAt: connector.createdAt,
  ...(connector.lastUsedAt ? { lastUsedAt: connector.lastUsedAt } : {}),
})

/**
 * AI assistant connections (MCP connectors) of the calling device. The device
 * that creates a connector owns it; the connector reaches the owner's lists
 * (all of them, or the picked ones) through `/v1/mcp/{key}`.
 */
export function registerConnectorRoutes(app: FastifyInstance, listRepository: ListRepository) {
  // The picked lists must be lists the owner can access itself.
  const parseConnectorInput = async (body: unknown, ownerDeviceId: string) => {
    const input = connectorBodySchema.parse(body)
    const listIds = input.includeAllLists ? [] : [...new Set(input.listIds)]
    const access = await Promise.all(listIds.map((listId) => listRepository.hasListAccess(listId, ownerDeviceId)))
    return access.every(Boolean) ? { ...input, listIds } : null
  }

  app.get('/v1/connectors', async (request) => {
    const headers = deviceHeaderSchema.parse(request.headers)
    const connectors = await listRepository.listConnectors(headers['x-device-id'])
    return { connectors: connectors.map(toConnectorResponse) }
  })

  app.post('/v1/connectors', async (request, reply) => {
    const headers = deviceHeaderSchema.parse(request.headers)
    const input = await parseConnectorInput(request.body, headers['x-device-id'])
    if (!input) {
      reply.code(403)
      return { message: 'Forbidden' }
    }

    const key = generateConnectorKey()
    const connector = await listRepository.createConnector(headers['x-device-id'], hashConnectorKey(key), input)
    reply.code(201)
    return { connector: toConnectorResponse(connector), key }
  })

  app.put('/v1/connectors/:connectorId', async (request, reply) => {
    const headers = deviceHeaderSchema.parse(request.headers)
    const { connectorId } = connectorParamsSchema.parse(request.params)
    const input = await parseConnectorInput(request.body, headers['x-device-id'])
    if (!input) {
      reply.code(403)
      return { message: 'Forbidden' }
    }

    const connector = await listRepository.updateConnector(connectorId, headers['x-device-id'], input)
    if (!connector) {
      reply.code(404)
      return { message: 'Connector not found' }
    }
    return toConnectorResponse(connector)
  })

  app.post('/v1/connectors/:connectorId/key', async (request, reply) => {
    const headers = deviceHeaderSchema.parse(request.headers)
    const { connectorId } = connectorParamsSchema.parse(request.params)
    const key = generateConnectorKey()
    if (!(await listRepository.rotateConnectorKey(connectorId, headers['x-device-id'], hashConnectorKey(key)))) {
      reply.code(404)
      return { message: 'Connector not found' }
    }
    return { key }
  })

  app.delete('/v1/connectors/:connectorId', async (request, reply) => {
    const headers = deviceHeaderSchema.parse(request.headers)
    const { connectorId } = connectorParamsSchema.parse(request.params)
    if (!(await listRepository.deleteConnector(connectorId, headers['x-device-id']))) {
      reply.code(404)
      return { message: 'Connector not found' }
    }
    reply.code(204)
  })
}
