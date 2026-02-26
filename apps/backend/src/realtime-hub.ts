import { type WebSocket } from '@fastify/websocket'

type RealtimeEvent = {
  type: 'list-updated'
  listId: string
  sourceDeviceId: string
  sentAt: string
}

type RealtimeConnection = {
  socket: WebSocket
  deviceId: string
}

const serializeListUpdatedEvent = (event: RealtimeEvent) => JSON.stringify(event)

export type RealtimeHub = {
  addConnection: (params: { listId: string; deviceId: string; socket: WebSocket }) => void
  notifyListUpdated: (params: { listId: string; sourceDeviceId: string }) => void
}

export function createRealtimeHub(): RealtimeHub {
  const listConnections = new Map<string, Set<RealtimeConnection>>()

  const removeConnection = (listId: string, connection: RealtimeConnection) => {
    const existing = listConnections.get(listId)
    if (!existing) {
      return
    }

    existing.delete(connection)
    if (existing.size === 0) {
      listConnections.delete(listId)
    }
  }

  const notifyListUpdated = (params: { listId: string; sourceDeviceId: string }) => {
    const existing = listConnections.get(params.listId)
    if (!existing || existing.size === 0) {
      return
    }

    const payload = serializeListUpdatedEvent({
      type: 'list-updated',
      listId: params.listId,
      sourceDeviceId: params.sourceDeviceId,
      sentAt: new Date().toISOString(),
    })

    for (const connection of existing) {
      if (connection.socket.readyState !== connection.socket.OPEN) {
        continue
      }

      connection.socket.send(payload)
    }
  }

  const addConnection = (params: { listId: string; deviceId: string; socket: WebSocket }) => {
    const connection: RealtimeConnection = {
      socket: params.socket,
      deviceId: params.deviceId,
    }

    const existing = listConnections.get(params.listId) ?? new Set<RealtimeConnection>()
    existing.add(connection)
    listConnections.set(params.listId, existing)

    params.socket.on('message', (rawMessage: string | Buffer | ArrayBuffer | Buffer[]) => {
      try {
        const payload = JSON.parse(rawMessage.toString())
        const messageType = typeof payload === 'object' && payload ? Reflect.get(payload, 'type') : null
        const messageListId = typeof payload === 'object' && payload ? Reflect.get(payload, 'listId') : null
        if (messageType !== 'list-updated' || messageListId !== params.listId) {
          return
        }

        notifyListUpdated({
          listId: params.listId,
          sourceDeviceId: params.deviceId,
        })
      } catch {
        return
      }
    })

    params.socket.on('close', () => {
      removeConnection(params.listId, connection)
    })

    params.socket.on('error', () => {
      removeConnection(params.listId, connection)
    })
  }

  return {
    addConnection,
    notifyListUpdated,
  }
}
