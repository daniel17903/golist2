import type { Item, ListType } from '@golist/shared/domain/types'
import type { WebSocket } from 'ws'

export type ListMetadataPayload = { name: string; listType: ListType; updatedAt: number }

/**
 * The WebSocket sockets subscribed to each list, and the patches pushed to
 * them. Shared by the WebSocket sync route and the MCP server, so a write an
 * AI assistant makes reaches the open apps right away.
 */
export class ListBroadcaster {
  private readonly subscribers = new Map<string, Set<WebSocket>>()

  add(listId: string, socket: WebSocket): void {
    const listSockets = this.subscribers.get(listId) ?? new Set<WebSocket>()
    listSockets.add(socket)
    this.subscribers.set(listId, listSockets)
  }

  remove(listId: string, socket: WebSocket): void {
    const listSockets = this.subscribers.get(listId)
    listSockets?.delete(socket)
    if (listSockets && listSockets.size === 0) {
      this.subscribers.delete(listId)
    }
  }

  count(listId: string): number {
    return this.subscribers.get(listId)?.size ?? 0
  }

  /** Sends to every socket subscribed to the list (the sender included). */
  broadcastItemPatch(listId: string, items: Item[]): void {
    for (const socket of this.subscribers.get(listId) ?? []) {
      send(socket, { type: 'item_patch', listId, items })
    }
  }

  /** Sends to every socket subscribed to the list except `except` (the sender). */
  broadcastListMetadataPatch(listId: string, payload: ListMetadataPayload, except?: WebSocket): void {
    for (const socket of this.subscribers.get(listId) ?? []) {
      if (socket !== except) {
        send(socket, { type: 'list_metadata_patch', listId, ...payload })
      }
    }
  }
}

export function send(socket: WebSocket, message: unknown): void {
  // A closing/closed socket only buffers data that is never delivered.
  if (socket.readyState !== socket.OPEN) {
    return
  }
  socket.send(JSON.stringify(message))
}
