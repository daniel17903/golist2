import { buildItemHash } from '@golist/shared/domain/sync'
import { listTypes, maxTodoPoints, type Item, type ListType } from '@golist/shared/domain/types'
import websocket from '@fastify/websocket'
import type { RawData, WebSocket } from 'ws'
import { type FastifyInstance } from 'fastify'
import { z } from 'zod'

import { todoFieldsToIso, toSyncItem } from '../repositories/item-snapshot.js'
import { type ListRepository } from '../repositories/list-repository.js'
import { ListBroadcaster, send as sendToSocket } from '../sync/list-broadcaster.js'
import { ListSyncCache } from '../sync/list-sync-cache.js'

declare module 'fastify' {
  interface FastifyInstance {
    // Number of sockets currently registered for broadcasts on a list.
    // Introspection for tests (dead-socket leak checks).
    syncSubscriberCount: (listId: string) => number
  }
}

type ClientMessage =
  | { type: 'hello'; deviceId: string }
  | { type: 'subscribe_list'; listId: string }
  | { type: 'unsubscribe_list'; listId: string }
  | { type: 'list_digest'; listId: string; digest: string }
  | { type: 'hash_diff'; listId: string; summaries: Array<{ itemId: string; itemHash: string; updatedAt: number }> }
  | { type: 'item_patch'; listId: string; items: Item[] }
  | { type: 'list_metadata_patch'; listId: string; name: string; listType?: ListType; updatedAt: number }

type ServerMessage =
  | { type: 'hello_ack' }
  | {
      type: 'subscribed'
      listId: string
      listName: string
      listType: ListType
      listUpdatedAt: number
      serverListDigest: string
    }
  | { type: 'hash_diff'; listId: string; summaries: Array<{ itemId: string; itemHash: string; updatedAt: number }> }
  | { type: 'item_patch'; listId: string; items: Item[] }
  | { type: 'list_metadata_patch'; listId: string; name: string; listType: ListType; updatedAt: number }
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
      description: z.string().min(1).optional(),
      points: z.number().int().positive().max(maxTodoPoints).optional(),
      completedAt: dateMillisSchema.optional(),
      dueDate: dateMillisSchema.optional(),
      assignedTo: z.string().min(1).optional(),
      recurrence: z.string().min(1).optional(),
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
  // Optional for clients that predate list types; unset keeps the stored type.
  listType: z.enum(listTypes).optional(),
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

export function registerSyncWebsocketRoute(
  app: FastifyInstance,
  listRepository: ListRepository,
  listSyncCache: ListSyncCache = new ListSyncCache(),
  broadcaster: ListBroadcaster = new ListBroadcaster(),
) {
  app.decorate('syncSubscriberCount', (listId: string) => broadcaster.count(listId))

  const loadSnapshot = (listId: string) =>
    listSyncCache.getSnapshot(listId, async () => (await listRepository.listItems(listId)).map(toSyncItem))

  const send = (socket: ServerSocket, message: ServerMessage) => sendToSocket(socket, message)

  // Stops broadcasts to the socket; the connection's logical subscription
  // (`state.subscribedListId`) is left alone.
  const detachFromBroadcasts = (socket: ServerSocket, state: ConnectionState) => {
    if (state.subscribedListId) {
      broadcaster.remove(state.subscribedListId, socket)
    }
  }

  const removeFromSubscription = (socket: ServerSocket, state: ConnectionState) => {
    detachFromBroadcasts(socket, state)
    state.subscribedListId = undefined
  }

  void app.register(async (websocketApp) => {
    await websocketApp.register(websocket)

    websocketApp.get('/v1/ws', { websocket: true }, (connection) => {
      const state: ConnectionState = {}
      const socket = toServerSocket(connection)

      // Handle this socket's messages strictly in arrival order. The handler
      // awaits the repository (e.g. the access check in subscribe_list), so
      // without this a patch sent right after a subscribe could be processed
      // before the subscription is registered and be dropped with "not
      // subscribed to list" (found by the web sync fuzzer, see
      // apps/web/sim/scenarios/races.sim.test.ts).
      let messageChain: Promise<void> = Promise.resolve()
      // A subscribe that was awaiting the database when the socket closed
      // must not register it: the close handler may already have run, so the
      // dead socket would otherwise stay in `subscribers` and receive every
      // broadcast for that list. `readyState` also covers the closing
      // handshake, before the 'close' event fires.
      //
      // Messages that arrived before the close are still processed: they are
      // writes the client already sent (e.g. a rename right before the app
      // closes) and must still be stored and broadcast to the other devices.
      // The close only detaches the socket from broadcasts; its logical
      // subscription stays so queued patches pass the subscription check.
      // Replies to the gone socket are dropped by `send()`.
      let closed = false
      const isGone = () => closed || socket.readyState !== socket.OPEN
      socket.on('message', (raw: RawData) => {
        messageChain = messageChain.then(() => handleMessage(raw))
      })

      const handleMessage = async (raw: RawData) => {
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
            if (isGone()) {
              // Track the subscription so writes queued behind it are still
              // applied, but never register a gone socket for broadcasts.
              return
            }
            broadcaster.add(parsedPayload.listId, socket)

            const snapshot = await loadSnapshot(parsedPayload.listId)
            const listRecord = await listRepository.getList(parsedPayload.listId)
            const listUpdatedAt = listRecord ? Date.parse(listRecord.updatedAt) : Date.now()
            send(socket, {
              type: 'subscribed',
              listId: parsedPayload.listId,
              listName: listRecord?.name ?? '',
              listType: listRecord?.listType ?? 'shopping',
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
                  ...todoFieldsToIso(item),
                },
              })),
            )

            const acceptedIndexes = results
              .map((result, index) =>
                result.outcome === 'created' || result.outcome === 'updated' ? index : -1,
              )
              .filter((index) => index >= 0)

            // A patch that lost last-write-wins is not broadcast, but its
            // sender must still learn the winning version — otherwise it
            // keeps showing its own losing write until it reconnects (found
            // by the web sync fuzzer).
            const losingIndexes = results
              .map((result, index) => (result.outcome === 'ignored' ? index : -1))
              .filter((index) => index >= 0)
            if (losingIndexes.length > 0) {
              const winners = await Promise.all(
                losingIndexes.map(async (index) => {
                  const stored = await listRepository.getListItem(parsedPayload.listId, parsedPayload.items[index].id)
                  const winner = stored ? toSyncItem(stored) : null
                  return winner && buildItemHash(winner) !== buildItemHash(parsedPayload.items[index]) ? winner : null
                }),
              )
              const differing = winners.filter((item): item is Item => item !== null)
              if (differing.length > 0) {
                send(socket, { type: 'item_patch', listId: parsedPayload.listId, items: differing })
              }
            }

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
                broadcaster.broadcastItemPatch(parsedPayload.listId, accepted)
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
              parsedPayload.listType,
            )
            if (listResult.outcome === 'forbidden') {
              send(socket, { type: 'error', message: 'forbidden' })
              return
            }

            // Stale patch lost the LWW comparison against the stored list —
            // unless the stored metadata already *is* this patch. Clients send
            // a rename over REST (PUT /v1/lists/:id) and over the socket with
            // the same name/updatedAt; when REST lands first the socket patch
            // is a no-op write, but subscribers still need the broadcast
            // because the REST route does not notify them.
            if (listResult.outcome === 'ignored') {
              const storedList = await listRepository.getList(parsedPayload.listId)
              const alreadyStored =
                storedList !== null &&
                storedList.name === parsedPayload.name &&
                (parsedPayload.listType === undefined || storedList.listType === parsedPayload.listType) &&
                Date.parse(storedList.updatedAt) === parsedPayload.updatedAt
              if (!alreadyStored) {
                // Tell the sender which name won so it does not keep its
                // losing rename (only other subscribers get broadcasts).
                if (storedList) {
                  send(socket, {
                    type: 'list_metadata_patch',
                    listId: parsedPayload.listId,
                    name: storedList.name,
                    listType: storedList.listType,
                    updatedAt: Date.parse(storedList.updatedAt),
                  })
                }
                return
              }
            }

            // List name/updatedAt aren't part of the item digest today, but
            // invalidate defensively so the cache can never serve a snapshot
            // that predates an accepted write to the list.
            listSyncCache.invalidate(parsedPayload.listId)

            // Broadcast the stored type: a patch without `listType` (an
            // older client) kept it, and subscribers need the full metadata.
            const storedListType =
              parsedPayload.listType ?? (await listRepository.getList(parsedPayload.listId))?.listType ?? 'shopping'
            broadcaster.broadcastListMetadataPatch(
              parsedPayload.listId,
              {
                name: parsedPayload.name,
                listType: storedListType,
                updatedAt: parsedPayload.updatedAt,
              },
              socket,
            )

            // A sender that did not name a type (a list stored before list
            // types existed) must still learn the stored one, or it keeps
            // showing its own default while every other device has the type
            // another device switched to.
            if (parsedPayload.listType === undefined) {
              send(socket, {
                type: 'list_metadata_patch',
                listId: parsedPayload.listId,
                name: parsedPayload.name,
                listType: storedListType,
                updatedAt: parsedPayload.updatedAt,
              })
            }
          }
        } catch (error) {
          app.log.warn({ err: error }, 'invalid websocket message')
          send(socket, { type: 'error', message: 'invalid_message' })
        }
      }

      socket.on('close', () => {
        closed = true
        // Keep `state.subscribedListId`: writes still queued in
        // `messageChain` for that list must be applied after the close.
        detachFromBroadcasts(socket, state)
      })
    })
  })
}
