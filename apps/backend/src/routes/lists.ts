import { type FastifyInstance } from 'fastify'
import { z } from 'zod'

import { createAuthGuards } from '../auth.js'
import { type ListRepository } from '../repositories/list-repository.js'

const listIdParamsSchema = z.object({ listId: z.uuid() })
const listPutBodySchema = z.object({ name: z.string().min(1) })
const listCreateHeadersSchema = z.object({ 'x-device-id': z.uuid() })
const itemParamsSchema = z.object({ listId: z.uuid(), itemId: z.uuid() })
const itemUpsertSchema = z.object({
  name: z.string().min(1),
  quantityOrUnit: z.string().min(1).optional(),
  category: z.string().min(1),
  deleted: z.boolean(),
  updatedAt: z.iso.datetime(),
})

export function registerListRoutes(app: FastifyInstance, listRepository: ListRepository) {
  const { requireListAccess } = createAuthGuards(listRepository)

  app.put('/v1/lists/:listId', async (request, reply) => {
    const params = listIdParamsSchema.parse(request.params)
    const body = listPutBodySchema.parse(request.body)
    const headers = listCreateHeadersSchema.parse(request.headers)

    const result = await listRepository.putList(params.listId, body.name, headers['x-device-id'])

    reply.code(result.statusCode)
    if (result.statusCode === 403) {
      return { message: 'Forbidden' }
    }

    return { listId: params.listId }
  })

  app.get('/v1/lists/:listId', { preHandler: requireListAccess }, async (request) => {
    const list = await listRepository.getList(request.auth!.listId)

    if (!list) {
      return {}
    }

    const items = await listRepository.listItems(request.auth!.listId)

    return {
      listId: list.id,
      name: list.name,
      createdAt: list.createdAt,
      updatedAt: list.updatedAt,
      items,
    }
  })

  app.delete('/v1/lists/:listId', { preHandler: requireListAccess }, async (request, reply) => {
    const deleted = await listRepository.deleteList(request.auth!.listId, request.auth!.deviceId)

    if (!deleted) {
      reply.code(403)
      return { message: 'Forbidden' }
    }

    reply.code(204)
  })

  app.get('/v1/lists/:listId/items', { preHandler: requireListAccess }, async (request) => {
    const querystring = z.object({ updatedAfter: z.iso.datetime() }).parse(request.query)
    const items = await listRepository.listItemsUpdatedAfter(request.auth!.listId, querystring.updatedAfter)

    return { items }
  })

  app.get('/v1/lists/:listId/items/:itemId', { preHandler: requireListAccess }, async (request, reply) => {
    const params = itemParamsSchema.parse(request.params)
    const item = await listRepository.getListItem(request.auth!.listId, params.itemId)

    if (!item) {
      reply.code(404)
      return { message: 'Item not found' }
    }

    return item
  })

  app.put('/v1/lists/:listId/items/:itemId', { preHandler: requireListAccess }, async (request, reply) => {
    const params = itemParamsSchema.parse(request.params)
    const body = itemUpsertSchema.parse(request.body)

    const result = await listRepository.upsertListItem(request.auth!.listId, params.itemId, request.auth!.deviceId, body)

    reply.code(result.statusCode)
    if (result.statusCode === 409) {
      return { message: 'Item id belongs to another list' }
    }
  })
}
