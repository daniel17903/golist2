import type { Item } from '@golist/shared/domain/types'
import { buildItemHash, buildItemSummaries, buildListDigest } from '@golist/shared/domain/sync'
import websocket from '@fastify/websocket'
import { type FastifyInstance } from 'fastify'
import { z } from 'zod'

import { type ListRepository, type ListItemRecord } from '../repositories/list-repository.js'

type ClientMessage =
  | { type: 'hello'; deviceId: string }
  | { type: 'subscribe_list'; listId: string }
  | { type: 'unsubscribe_list'; listId: string }
  | { type: 'list_digest'; listId: string; digest: string }
  | { type: 'hash_diff'; listId: string; summaries: Array<{ itemId: string; itemHash: string; updatedAt: number }> }
  | { type: 'item_patch'; listId: string; items: Item[] }
  | { type: 'ping' }

type ServerMessage =
  | { type: 'hello_ack' }
  | { type: 'subscribed'; listId: string; serverListDigest: string }
  | { type: 'hash_diff'; listId: string; summaries: Array<{ itemId: string; itemHash: string; updatedAt: number }> }
  | { type: 'item_patch'; listId: string; items: Item[] }
  | { type: 'pong' }
  | { type: 'error'; message: string }

const helloSchema = z.object({ type: z.literal('hello'), deviceId: z.uuid() })
const subscribeSchema = z.object({ type: z.literal('subscribe_list'), listId: z.uuid() })
const unsubscribeSchema = z.object({ type: z.literal('unsubscribe_list'), listId: z.uuid() })
const digestSchema = z.object({ type: z.literal('list_digest'), listId: z.uuid(), digest: z.string().min(1) })
const hashDiffSchema = z.object({
  type: z.literal('hash_diff'),
  listId: z.uuid(),
  summaries: z.array(z.object({ itemId: z.uuid(), itemHash: z.string().min(1), updatedAt: z.number().int() })),
})
const itemPatchSchema = z.object({
  type: z.literal('item_patch'),
  listId: z.uuid(),
  items: z.array(
    z.object({
      id: z.uuid(),
      listId: z.uuid(),
      name: z.string().min(1),
      iconName: z.string().min(1),
      quantityOrUnit: z.string().min(1).optional(),
      category: z.string().min(1),
      deleted: z.boolean(),
      createdAt: z.number().int(),
      updatedAt: z.number().int(),
    }),
  ),
})

type ConnectionState = {
  deviceId?: string
  subscribedListId?: string
}

const parseClientMessage = (payload: unknown): ClientMessage => {
  if (typeof payload !== 'object' || payload === null) {
    throw new Error('Expected object message')
  }

  const type = Reflect.get(payload, 'type')
  if (type === 'hello') {
    return helloSchema.parse(payload)
  }
  if (type === 'subscribe_list') {
    return subscribeSchema.parse(payload)
  }
  if (type === 'unsubscribe_list') {
    return unsubscribeSchema.parse(payload)
  }
  if (type === 'list_digest') {
    return digestSchema.parse(payload)
  }
  if (type === 'hash_diff') {
    return hashDiffSchema.parse(payload)
  }
  if (type === 'item_patch') {
    return itemPatchSchema.parse(payload)
  }
  if (type === 'ping') {
    return { type: 'ping' }
  }

  throw new Error('Unsupported message type')
}

const toSyncItem = (item: ListItemRecord): Item => ({
  id: item.id,
  listId: item.listId,
  name: item.name,
  iconName: item.iconName,
  quantityOrUnit: item.quantityOrUnit,
  category: item.category,
  deleted: item.deleted,
  createdAt: Date.parse(item.createdAt),
  updatedAt: Date.parse(item.updatedAt),
})

export function registerSyncWebsocketRoute(app: FastifyInstance, listRepository: ListRepository) {
  void app.register(websocket)

  const subscribers = new Map<string, Set<ServerSocket>>()

  type ServerSocket = { send: (payload: string) => void; on: (event: string, cb: (...args: any[]) => void) => void }

  const send = (socket: ServerSocket, message: ServerMessage) => {
    socket.send(JSON.stringify(message))
  }

  const removeFromSubscription = (socket: ServerSocket, state: ConnectionState) => {
    if (!state.subscribedListId) {
      return
    }
    const listSockets = subscribers.get(state.subscribedListId)
    listSockets?.delete(socket)
    if (listSockets && listSockets.size === 0) {
      subscribers.delete(state.subscribedListId)
    }
    state.subscribedListId = undefined
  }

  const broadcastItemPatch = (listId: string, items: Item[], sender: ServerSocket) => {
    const listSockets = subscribers.get(listId)
    if (!listSockets) {
      return
    }

    for (const socket of listSockets.values()) {
      if (socket === sender) {
        continue
      }
      send(socket, { type: 'item_patch', listId, items })
    }
  }

  app.get('/v1/ws', { websocket: true }, (socket) => {
    const state: ConnectionState = {}

    socket.on('message', async (raw: unknown) => {
      try {
        const payloadText = typeof raw === 'string' ? raw : String(raw)
        const parsedPayload = parseClientMessage(JSON.parse(payloadText))

        if (parsedPayload.type === 'hello') {
          state.deviceId = parsedPayload.deviceId
          send(socket, { type: 'hello_ack' })
          return
        }

        if (!state.deviceId) {
          send(socket, { type: 'error', message: 'hello is required before other messages' })
          return
        }

        if (parsedPayload.type === 'ping') {
          send(socket, { type: 'pong' })
          return
        }

        if (parsedPayload.type === 'unsubscribe_list') {
          if (state.subscribedListId === parsedPayload.listId) {
            removeFromSubscription(socket, state)
          }
          return
        }

        if (parsedPayload.type === 'subscribe_list') {
          const hasAccess = await listRepository.hasListAccess(parsedPayload.listId, state.deviceId)
          if (!hasAccess) {
            send(socket, { type: 'error', message: 'forbidden' })
            return
          }

          removeFromSubscription(socket, state)
          state.subscribedListId = parsedPayload.listId
          const listSockets = subscribers.get(parsedPayload.listId) ?? new Set<ServerSocket>()
          listSockets.add(socket)
          subscribers.set(parsedPayload.listId, listSockets)

          const serverItems = (await listRepository.listItems(parsedPayload.listId)).map(toSyncItem)
          send(socket, {
            type: 'subscribed',
            listId: parsedPayload.listId,
            serverListDigest: buildListDigest(serverItems),
          })
          send(socket, {
            type: 'hash_diff',
            listId: parsedPayload.listId,
            summaries: buildItemSummaries(serverItems),
          })
          return
        }

        if (!state.subscribedListId || state.subscribedListId !== parsedPayload.listId) {
          send(socket, { type: 'error', message: 'not subscribed to list' })
          return
        }

        if (parsedPayload.type === 'list_digest') {
          const serverItems = (await listRepository.listItems(parsedPayload.listId)).map(toSyncItem)
          const serverDigest = buildListDigest(serverItems)
          if (serverDigest !== parsedPayload.digest) {
            send(socket, {
              type: 'hash_diff',
              listId: parsedPayload.listId,
              summaries: buildItemSummaries(serverItems),
            })
          }
          return
        }

        if (parsedPayload.type === 'hash_diff') {
          const serverItems = (await listRepository.listItems(parsedPayload.listId)).map(toSyncItem)
          const clientSummaryById = new Map(parsedPayload.summaries.map((entry) => [entry.itemId, entry]))

          const serverMissingOrStaleForClient = serverItems.filter((serverItem) => {
            const summary = clientSummaryById.get(serverItem.id)
            if (!summary) {
              return true
            }
            return summary.itemHash !== buildItemHash(serverItem)
          })

          if (serverMissingOrStaleForClient.length > 0) {
            send(socket, {
              type: 'item_patch',
              listId: parsedPayload.listId,
              items: serverMissingOrStaleForClient,
            })
          }
          return
        }

        if (parsedPayload.type === 'item_patch') {
          const accepted: Item[] = []
          for (const item of parsedPayload.items) {
            const existing = await listRepository.getListItem(parsedPayload.listId, item.id)
            const incomingIso = new Date(item.updatedAt).toISOString()

            if (existing) {
              const existingMillis = Date.parse(existing.updatedAt)
              if (existingMillis > item.updatedAt) {
                continue
              }
            }

            await listRepository.upsertListItem(parsedPayload.listId, item.id, state.deviceId, {
              name: item.name,
              iconName: item.iconName,
              quantityOrUnit: item.quantityOrUnit,
              category: item.category,
              deleted: item.deleted,
              updatedAt: incomingIso,
            })
            accepted.push(item)
          }

          if (accepted.length > 0) {
            broadcastItemPatch(parsedPayload.listId, accepted, socket)
          }
        }
      } catch (error) {
        app.log.warn({ err: error }, 'invalid websocket message')
        send(socket, { type: 'error', message: 'invalid_message' })
      }
    })

    socket.on('close', () => {
      removeFromSubscription(socket, state)
    })
  })
}
