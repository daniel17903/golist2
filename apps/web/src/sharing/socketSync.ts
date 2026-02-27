import type { Item } from '@golist/shared/domain/types';
import { buildItemHash, buildItemSummaries, buildListDigest } from '@golist/shared/domain/sync';

import { isBackendSharingEnabled } from './apiClient';

type SocketSyncCallbacks = {
  getItemsForList: (listId: string) => Item[];
  applyIncomingItems: (listId: string, items: Item[]) => Promise<void>;
  onConnectionState: (state: 'online' | 'offline') => void;
  onError: (message: string) => void;
};

type OutboundPatch = { listId: string; item: Item };

const createWebSocketUrl = (): string | null => {
  if (!isBackendSharingEnabled || typeof __API_BASE_URL__ !== 'string' || !__API_BASE_URL__) {
    return null;
  }

  const url = new URL(__API_BASE_URL__);
  url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:';
  url.pathname = '/v1/ws';
  return url.toString();
};


const isMessagePayload = (value: unknown): value is { type?: string; [key: string]: unknown } =>
  typeof value === 'object' && value !== null;

const isSyncItem = (value: unknown): value is Item =>
  typeof value === 'object' &&
  value !== null &&
  typeof Reflect.get(value, 'id') === 'string' &&
  typeof Reflect.get(value, 'listId') === 'string' &&
  typeof Reflect.get(value, 'name') === 'string' &&
  typeof Reflect.get(value, 'iconName') === 'string' &&
  typeof Reflect.get(value, 'category') === 'string' &&
  typeof Reflect.get(value, 'deleted') === 'boolean' &&
  typeof Reflect.get(value, 'createdAt') === 'number' &&
  typeof Reflect.get(value, 'updatedAt') === 'number';

class SocketSyncManager {
  private socket: WebSocket | null = null;
  private callbacks: SocketSyncCallbacks | null = null;
  private subscribedListId: string | null = null;
  private deviceId: string | null = null;
  private reconnectAttempts = 0;
  private reconnectTimer: number | null = null;
  private queue: OutboundPatch[] = [];

  init(deviceId: string, callbacks: SocketSyncCallbacks) {
    this.deviceId = deviceId;
    this.callbacks = callbacks;
    this.connect();
  }

  setActiveList(listId: string | undefined) {
    const nextListId = listId ?? null;
    if (this.subscribedListId === nextListId) {
      return;
    }

    const previousListId = this.subscribedListId;
    this.subscribedListId = nextListId;

    if (!this.socket || this.socket.readyState !== WebSocket.OPEN) {
      return;
    }

    if (previousListId) {
      this.send({ type: 'unsubscribe_list', listId: previousListId });
    }

    if (nextListId) {
      this.send({ type: 'subscribe_list', listId: nextListId });
    }
  }

  queueLocalItemPatch(item: Item) {
    this.queue.push({ listId: item.listId, item });
    this.flushQueue();
  }

  requestResync() {
    if (!this.subscribedListId || !this.callbacks) {
      return;
    }

    this.sendDigest(this.subscribedListId);
  }

  private connect() {
    if (!this.deviceId) {
      return;
    }

    const url = createWebSocketUrl();
    if (!url) {
      return;
    }

    if (this.socket && (this.socket.readyState === WebSocket.OPEN || this.socket.readyState === WebSocket.CONNECTING)) {
      return;
    }

    this.socket = new WebSocket(url);

    this.socket.addEventListener('open', () => {
      this.reconnectAttempts = 0;
      this.callbacks?.onConnectionState('online');
      this.send({ type: 'hello', deviceId: this.deviceId });
      if (this.subscribedListId) {
        this.send({ type: 'subscribe_list', listId: this.subscribedListId });
      }
      this.flushQueue();
    });

    this.socket.addEventListener('message', (event) => {
      void this.handleMessage(event.data);
    });

    this.socket.addEventListener('close', () => {
      this.callbacks?.onConnectionState('offline');
      this.scheduleReconnect();
    });

    this.socket.addEventListener('error', () => {
      this.callbacks?.onConnectionState('offline');
    });
  }

  private scheduleReconnect() {
    if (this.reconnectAttempts >= 5) {
      this.callbacks?.onError('Realtime sync retries exhausted.');
      return;
    }

    this.reconnectAttempts += 1;
    const jitter = Math.floor(Math.random() * 200);
    const delay = Math.min(5000, 250 * 2 ** this.reconnectAttempts) + jitter;

    if (this.reconnectTimer !== null) {
      window.clearTimeout(this.reconnectTimer);
    }

    this.reconnectTimer = window.setTimeout(() => {
      this.connect();
    }, delay);
  }

  private async handleMessage(rawData: unknown) {
    if (typeof rawData !== 'string') {
      return;
    }

    const parsed = JSON.parse(rawData);
    if (!isMessagePayload(parsed)) {
      return;
    }

    const payload = parsed;

    if (payload.type === 'subscribed') {
      const listId = typeof payload.listId === 'string' ? payload.listId : null;
      if (listId) {
        this.sendDigest(listId);
      }
      return;
    }

    if (payload.type === 'hash_diff') {
      const listId = typeof payload.listId === 'string' ? payload.listId : null;
      if (!listId || !this.callbacks) {
        return;
      }

      const localItems = this.callbacks.getItemsForList(listId);
      const localSummaries = buildItemSummaries(localItems);
      this.send({ type: 'hash_diff', listId, summaries: localSummaries });

      const remoteRawSummaries = Array.isArray(payload.summaries) ? payload.summaries : [];
      const remoteSummaryById = new Map(
        remoteRawSummaries
          .filter((entry): entry is { itemId: string; itemHash: string } =>
            typeof entry === 'object' &&
            entry !== null &&
            typeof Reflect.get(entry, 'itemId') === 'string' &&
            typeof Reflect.get(entry, 'itemHash') === 'string',
          )
          .map((entry) => [entry.itemId, entry]),
      );

      const localMissingOrStaleForRemote = localItems.filter((item) => {
        const remoteEntry = remoteSummaryById.get(item.id);
        if (!remoteEntry) {
          return true;
        }
        return remoteEntry.itemHash !== buildItemHash(item);
      });

      if (localMissingOrStaleForRemote.length > 0) {
        this.send({ type: 'item_patch', listId, items: localMissingOrStaleForRemote });
      }
      return;
    }

    if (payload.type === 'item_patch') {
      const listId = typeof payload.listId === 'string' ? payload.listId : null;
      const items = Array.isArray(payload.items) ? payload.items.filter((entry) => isSyncItem(entry)) : [];
      if (listId && items.length > 0) {
        await this.callbacks?.applyIncomingItems(listId, items);
      }
      return;
    }

    if (payload.type === 'error') {
      const message = typeof payload.message === 'string' ? payload.message : 'sync error';
      this.callbacks?.onError(message);
    }
  }

  private sendDigest(listId: string) {
    if (!this.callbacks) {
      return;
    }

    const localItems = this.callbacks.getItemsForList(listId);
    this.send({ type: 'list_digest', listId, digest: buildListDigest(localItems) });
  }

  private flushQueue() {
    if (!this.socket || this.socket.readyState !== WebSocket.OPEN) {
      return;
    }

    if (!this.subscribedListId) {
      return;
    }

    const ready = this.queue.filter((entry) => entry.listId === this.subscribedListId);
    if (ready.length === 0) {
      return;
    }

    this.queue = this.queue.filter((entry) => entry.listId !== this.subscribedListId);
    this.send({ type: 'item_patch', listId: this.subscribedListId, items: ready.map((entry) => entry.item) });
  }

  private send(payload: Record<string, unknown>) {
    if (!this.socket || this.socket.readyState !== WebSocket.OPEN) {
      return;
    }

    this.socket.send(JSON.stringify(payload));
  }
}

export const socketSyncManager = new SocketSyncManager();
