import type { Item } from '@golist/shared/domain/types'
import websocket from '@fastify/websocket'
import type { RawData, WebSocket } from 'ws'
import { type FastifyInstance } from 'fastify'
import { z } from 'zod'

import { type ListRepository, type ListItemRecord } from '../repositories/list-repository.js'
import { ListSyncCache } from '../sync/list-sync-cache.js'

type ClientMessage =
  | { type: 'hello'; deviceId: string }
  | { type: 'subscribe_list'; listId: string }
  | { type: 'unsubscribe_list'; listId: string }
  | { type: 'list_digest'; listId: string; digest: string }
  | { type: 'hash_diff'; listId: string; summaries: Array<{ itemId: string; itemHash: string; updatedAt: number }> }
  | { type: 'item_patch'; listId: string; items: Item[] }
  | { type: 'list_metadata_patch'; listId: string; name: string; updatedAt: number }

type ServerMessage =
  | { type: 'hello_ack' }
  | { type: 'subscribed'; listId: string; listName: string; listUpdatedAt: number; serverListDigest: string }
  | { type: 'hash_diff'; listId: string; summaries: Array<{ itemId: string; itemHash: string; updatedAt: number }> }
  | { type: 'item_patch'; listId: string; items: Item[] }
  | { type: 'list_metadata_patch'; listId: string; name: string; updatedAt: number }
  | { type: 'error'; message: string }

const helloSchema = z.object({ type: z.literal('hello'), deviceId: z.uuid() })
const dateMillisSchema = z.number().int().min(-8_640_000_000_000_000).max(8_640_000_000_000_000)
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
      createdAt: dateMillisSchema,
      updatedAt: dateMillisSchema,
    }),
  ),
}).superRefine((payload, context) => {
  payload.items.forEach((item, index) => {
    if (item.listId !== payload.listId) {
      context.addIssue({
        code: 'custom',
        message: 'Item listId must match patch listId',
        path: ['items', index, 'listId'],
      })
    }
  })
})
const listMetadataPatchSchema = z.object({
  type: z.literal('list_metadata_patch'),
  listId: z.uuid(),
  name: z.string().min(1),
  updatedAt: dateMillisSchema,
})

type ConnectionState = {
  deviceId?: string
  subscribedListId?: string
}

type ServerSocket = WebSocket

const isServerSocket = (value: unknown): value is ServerSocket =>
  typeof value === 'object' &&
  value !== null &&
  typeof Reflect.get(value, 'send') === 'function' &&
  typeof Reflect.get(value, 'on') === 'function'

const toServerSocket = (connection: unknown): ServerSocket => {
  if (isServerSocket(connection)) {
    return connection
  }

  const nestedSocket = typeof connection === 'object' && connection !== null ? Reflect.get(connection, 'socket') : null
  if (isServerSocket(nestedSocket)) {
    return nestedSocket
  }

  throw new Error('Invalid websocket connection')
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
  if (type === 'list_metadata_patch') {
    return listMetadataPatchSchema.parse(payload)
  }

  throw new Error('Unsupported message type')
}

const rawDataToString = (raw: RawData): string => {
  if (typeof raw === 'string') {
    return raw
  }

  if (raw instanceof ArrayBuffer) {
    return Buffer.from(raw).toString('utf8')
  }

  if (Array.isArray(raw)) {
    return Buffer.concat(raw).toString('utf8')
  }

  return raw.toString('utf8')
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

export function registerSyncWebsocketRoute(
  app: FastifyInstance,
  listRepository: ListRepository,
  listSyncCache: ListSyncCache = new ListSyncCache(),
) {
  const subscribers = new Map<string, Set<ServerSocket>>()

  const loadSnapshot = (listId: string) =>
    listSyncCache.getSnapshot(listId, async () => (await listRepository.listItems(listId)).map(toSyncItem))

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

  const broadcastItemPatch = (listId: string, items: Item[]) => {
    const listSockets = subscribers.get(listId)
    if (!listSockets) {
      return
    }

    for (const socket of listSockets.values()) {
      send(socket, { type: 'item_patch', listId, items })
    }
  }

  const broadcastListMetadataPatch = (
    listId: string,
    payload: { name: string; updatedAt: number },
    sender: ServerSocket,
  ) => {
    const listSockets = subscribers.get(listId)
    if (!listSockets) {
      return
    }

    for (const socket of listSockets.values()) {
      if (socket === sender) {
        continue
      }

      send(socket, {
        type: 'list_metadata_patch',
        listId,
        name: payload.name,
        updatedAt: payload.updatedAt,
      })
    }
  }

  void app.register(async (websocketApp) => {
    await websocketApp.register(websocket)

    websocketApp.get('/v1/ws', { websocket: true }, (connection) => {
      const state: ConnectionState = {}
      const socket = toServerSocket(connection)

      socket.on('message', async (raw: RawData) => {
        try {
          const parsedPayload = parseClientMessage(JSON.parse(rawDataToString(raw)))

          if (parsedPayload.type === 'hello') {
            state.deviceId = parsedPayload.deviceId
            send(socket, { type: 'hello_ack' })
            return
          }

          if (!state.deviceId) {
            send(socket, { type: 'error', message: 'hello is required before other messages' })
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

            const snapshot = await loadSnapshot(parsedPayload.listId)
            const listRecord = await listRepository.getList(parsedPayload.listId)
            const listUpdatedAt = listRecord ? Date.parse(listRecord.updatedAt) : Date.now()
            send(socket, {
              type: 'subscribed',
              listId: parsedPayload.listId,
              listName: listRecord?.name ?? '',
              listUpdatedAt,
              serverListDigest: snapshot.digest,
            })
            send(socket, {
              type: 'hash_diff',
              listId: parsedPayload.listId,
              summaries: snapshot.summaries,
            })
            return
          }

          if (!state.subscribedListId || state.subscribedListId !== parsedPayload.listId) {
            send(socket, { type: 'error', message: 'not subscribed to list' })
            return
          }

          if (parsedPayload.type === 'list_digest') {
            const snapshot = await loadSnapshot(parsedPayload.listId)
            if (snapshot.digest !== parsedPayload.digest) {
              send(socket, {
                type: 'hash_diff',
                listId: parsedPayload.listId,
                summaries: snapshot.summaries,
              })
            }
            return
          }

          if (parsedPayload.type === 'hash_diff') {
            const snapshot = await loadSnapshot(parsedPayload.listId)
            const clientSummaryById = new Map(parsedPayload.summaries.map((entry) => [entry.itemId, entry]))
            const serverSummaryById = new Map(snapshot.summaries.map((entry) => [entry.itemId, entry]))

            const serverMissingOrStaleForClient = snapshot.items.filter((serverItem) => {
              const clientSummary = clientSummaryById.get(serverItem.id)
              if (!clientSummary) {
                return true
              }
              return serverSummaryById.get(serverItem.id)?.itemHash !== clientSummary.itemHash
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
            const results = await listRepository.upsertListItems(
              parsedPayload.listId,
              state.deviceId,
              parsedPayload.items.map((item) => ({
                itemId: item.id,
                input: {
                  name: item.name,
                  iconName: item.iconName,
                  quantityOrUnit: item.quantityOrUnit,
                  category: item.category,
                  deleted: item.deleted,
                  updatedAt: new Date(item.updatedAt).toISOString(),
                },
              })),
            )

            const acceptedIndexes = results
              .map((result, index) =>
                result.outcome === 'created' || result.outcome === 'updated' ? index : -1,
              )
              .filter((index) => index >= 0)

            if (acceptedIndexes.length > 0) {
              // The cached digest/summaries snapshot no longer reflects the
              // persisted item set, so drop it and let the next
              // subscribe_list/list_digest/hash_diff rebuild it from Postgres.
              listSyncCache.invalidate(parsedPayload.listId)

              const canonicalItems = await Promise.all(
                acceptedIndexes.map(async (index) => {
                  const item = await listRepository.getListItem(
                    parsedPayload.listId,
                    parsedPayload.items[index].id,
                  )
                  return item ? toSyncItem(item) : null
                }),
              )
              const accepted = canonicalItems.filter((item): item is Item => item !== null)
              if (accepted.length > 0) {
                // Include the sender so its client-generated createdAt/listId
                // are replaced with the canonical persisted representation.
                broadcastItemPatch(parsedPayload.listId, accepted)
              }
            }

            return
          }

          if (parsedPayload.type === 'list_metadata_patch') {
            const listResult = await listRepository.putList(
              parsedPayload.listId,
              parsedPayload.name,
              state.deviceId,
              new Date(parsedPayload.updatedAt).toISOString(),
            )
            if (listResult.outcome === 'forbidden') {
              send(socket, { type: 'error', message: 'forbidden' })
              return
            }

            // Stale patch lost the LWW comparison against the stored list.
            if (listResult.outcome === 'ignored') {
              return
            }

            // List name/updatedAt aren't part of the item digest today, but
            // invalidate defensively so the cache can never serve a snapshot
            // that predates an accepted write to the list.
            listSyncCache.invalidate(parsedPayload.listId)

            broadcastListMetadataPatch(
              parsedPayload.listId,
              {
                name: parsedPayload.name,
                updatedAt: parsedPayload.updatedAt,
              },
              socket,
            )
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
  })
}
