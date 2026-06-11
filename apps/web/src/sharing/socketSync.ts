import type { Item } from '@golist/shared/domain/types';
import { buildItemHash, buildItemSummaries, buildListDigest } from '@golist/shared/domain/sync';

import { isBackendSharingEnabled } from './apiClient';

type SocketSyncCallbacks = {
  getItemsForList: (listId: string) => Item[];
  getAllListIds: () => string[];
  getListMetadata: (listId: string) => { name: string; updatedAt: number } | null;
  ensureListExists: (listId: string) => Promise<boolean>;
  applyIncomingItems: (listId: string, items: Item[]) => Promise<void>;
  applyIncomingListMetadata: (listId: string, payload: { name: string; updatedAt: number }) => Promise<void>;
  onConnectionState: (state: 'online' | 'offline') => void;
  onError: (message: string) => void;
};

type OutboundPatch = { listId: string; item: Item };
type OutboundListMetadataPatch = { listId: string; name: string; updatedAt: number };

const createWebSocketUrl = (): string | null => {
  if (!isBackendSharingEnabled || typeof __API_BASE_URL__ !== 'string' || !__API_BASE_URL__) {
    return null;
  }

  const url = new URL(__API_BASE_URL__);
  url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:';
  const basePath = url.pathname.replace(/\/$/, '');
  url.pathname = `${basePath}/v1/ws`;
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

// Per-list reconciliation step during a full sync is abandoned after this
// long so a single unresponsive list cannot stall the remaining lists.
const FULL_SYNC_STEP_TIMEOUT_MS = 8000;

class SocketSyncManager {
  private socket: WebSocket | null = null;
  private callbacks: SocketSyncCallbacks | null = null;
  private subscribedListId: string | null = null;
  private desiredListId: string | null = null;
  private deviceId: string | null = null;
  private reconnectAttempts = 0;
  private isSubscribedReady = false;
  private reconnectTimer: number | null = null;
  private onlineListenerRegistered = false;
  private queue: OutboundPatch[] = [];
  private listMetadataQueue: OutboundListMetadataPatch[] = [];
  private fullSyncPending = false;
  private fullSyncQueue: string[] = [];
  private fullSyncStepTimer: number | null = null;
  private forceReconnectPending = false;
  private forcedReconnectPromise: Promise<'success' | 'failed'> | null = null;
  private forcedReconnectResolver: ((result: 'success' | 'failed') => void) | null = null;
  private forcedReconnectTimeout: number | null = null;
  private consecutiveForbiddenCount = 0;

  init(deviceId: string, callbacks: SocketSyncCallbacks) {
    this.deviceId = deviceId;
    this.callbacks = callbacks;

    if (!this.onlineListenerRegistered && typeof window !== 'undefined') {
      window.addEventListener('online', () => {
        if (this.socket && this.socket.readyState === WebSocket.OPEN) {
          return;
        }

        if (this.reconnectTimer !== null) {
          window.clearTimeout(this.reconnectTimer);
          this.reconnectTimer = null;
        }

        this.connect();
      });
      this.onlineListenerRegistered = true;
    }

    this.connect();
  }

  setActiveList(listId: string | undefined) {
    const nextListId = listId ?? null;
    const previousDesiredListId = this.desiredListId;
    this.desiredListId = nextListId;
    this.fullSyncQueue = this.fullSyncQueue.filter((entry) => entry !== nextListId);

    if (this.subscribedListId === nextListId && this.isSubscribedReady) {
      return;
    }

    const previousListId = this.subscribedListId;
    // An interrupted full-sync list still needs its reconciliation pass later.
    if (
      previousListId &&
      previousListId !== nextListId &&
      previousListId !== previousDesiredListId &&
      !this.fullSyncQueue.includes(previousListId)
    ) {
      this.fullSyncQueue.unshift(previousListId);
    }

    this.clearFullSyncStepTimer();
    this.subscribedListId = nextListId;
    this.isSubscribedReady = false;
    this.consecutiveForbiddenCount = 0;

    if (!this.socket || this.socket.readyState !== WebSocket.OPEN) {
      this.connect();
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

  queueLocalListMetadataPatch(listId: string, payload: { name: string; updatedAt: number }) {
    this.listMetadataQueue.push({ listId, ...payload });
    this.flushQueue();
  }

  requestResync() {
    if (!this.subscribedListId || !this.callbacks || !this.isSubscribedReady) {
      return;
    }

    this.sendDigest(this.subscribedListId);
  }

  forceReconnect(): Promise<'success' | 'failed'> {
    if (this.forcedReconnectPromise) {
      return this.forcedReconnectPromise;
    }

    this.forcedReconnectPromise = new Promise((resolve) => {
      this.forcedReconnectResolver = resolve;
    });

    if (this.forcedReconnectTimeout !== null) {
      window.clearTimeout(this.forcedReconnectTimeout);
    }

    this.forcedReconnectTimeout = window.setTimeout(() => {
      this.finishForcedReconnect('failed');
    }, 8000);

    if (this.reconnectTimer !== null) {
      window.clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    this.reconnectAttempts = 0;
    this.isSubscribedReady = false;

    if (this.socket && (this.socket.readyState === WebSocket.OPEN || this.socket.readyState === WebSocket.CONNECTING)) {
      this.forceReconnectPending = true;
      this.socket.close();
      return this.forcedReconnectPromise;
    }

    this.connect();
    return this.forcedReconnectPromise;
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

    let socket: WebSocket;
    try {
      socket = new WebSocket(url);
    } catch {
      this.callbacks?.onConnectionState('offline');
      this.scheduleReconnect();
      return;
    }

    this.socket = socket;

    socket.addEventListener('open', () => {
      if (this.socket !== socket) {
        return;
      }

      if (this.reconnectTimer !== null) {
        window.clearTimeout(this.reconnectTimer);
        this.reconnectTimer = null;
      }
      this.reconnectAttempts = 0;
      this.callbacks?.onConnectionState('online');
      this.isSubscribedReady = false;
      this.consecutiveForbiddenCount = 0;
      this.fullSyncPending = true;
      this.send({ type: 'hello', deviceId: this.deviceId });
      if (this.subscribedListId) {
        this.send({ type: 'subscribe_list', listId: this.subscribedListId });
      } else {
        this.startFullSync();
      }
      this.flushQueue();
      this.finishForcedReconnect('success');
    });

    socket.addEventListener('message', (event) => {
      if (this.socket !== socket) {
        return;
      }

      void this.handleMessage(event.data);
    });

    socket.addEventListener('close', () => {
      if (this.socket !== socket) {
        return;
      }

      const shouldReconnectImmediately = this.forceReconnectPending;
      this.forceReconnectPending = false;
      this.socket = null;
      this.isSubscribedReady = false;
      this.cancelFullSync();
      this.callbacks?.onConnectionState('offline');

      if (shouldReconnectImmediately) {
        this.connect();
        return;
      }

      if (this.forcedReconnectPromise) {
        this.finishForcedReconnect('failed');
      }

      this.scheduleReconnect();
    });

    socket.addEventListener('error', () => {
      if (this.socket !== socket) {
        return;
      }

      this.callbacks?.onConnectionState('offline');
      this.isSubscribedReady = false;
      this.cancelFullSync();

      if (this.forcedReconnectPromise && !this.forceReconnectPending) {
        this.finishForcedReconnect('failed');
      }

      this.socket = null;
      this.scheduleReconnect();
    });
  }

  private finishForcedReconnect(result: 'success' | 'failed') {
    if (this.forcedReconnectTimeout !== null) {
      window.clearTimeout(this.forcedReconnectTimeout);
      this.forcedReconnectTimeout = null;
    }

    const resolver = this.forcedReconnectResolver;
    this.forcedReconnectResolver = null;
    this.forcedReconnectPromise = null;

    if (resolver) {
      resolver(result);
    }
  }

  private scheduleReconnect() {
    if (this.reconnectTimer !== null) {
      return;
    }

    const delay = this.reconnectAttempts < 3 ? 3000 : 10000;
    this.reconnectAttempts += 1;

    this.reconnectTimer = window.setTimeout(() => {
      this.reconnectTimer = null;
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
      const listName = typeof payload.listName === 'string' ? payload.listName : null;
      const listUpdatedAt = typeof payload.listUpdatedAt === 'number' ? payload.listUpdatedAt : null;
      if (listId && listId === this.subscribedListId) {
        this.isSubscribedReady = true;
        this.consecutiveForbiddenCount = 0;
        if (listName && listUpdatedAt !== null) {
          await this.callbacks?.applyIncomingListMetadata(listId, {
            name: listName,
            updatedAt: listUpdatedAt,
          });
        }
        // A rename made while offline survives only in IndexedDB — push it
        // back to the backend when the local copy is newer.
        const localMetadata = this.callbacks?.getListMetadata(listId) ?? null;
        if (localMetadata && listUpdatedAt !== null && localMetadata.updatedAt > listUpdatedAt) {
          this.send({
            type: 'list_metadata_patch',
            listId,
            name: localMetadata.name,
            updatedAt: localMetadata.updatedAt,
          });
        }
        this.flushQueue();
      }
      return;
    }

    if (payload.type === 'hash_diff') {
      const listId = typeof payload.listId === 'string' ? payload.listId : null;
      if (!listId || !this.callbacks || listId !== this.subscribedListId) {
        return;
      }

      const localItems = this.callbacks.getItemsForList(listId);
      const localSummaries = buildItemSummaries(localItems);
      this.send({ type: 'hash_diff', listId, summaries: localSummaries });

      const remoteRawSummaries = Array.isArray(payload.summaries) ? payload.summaries : [];
      const remoteSummaryById = new Map(
        remoteRawSummaries
          .filter((entry): entry is { itemId: string; updatedAt: number; itemHash: string } =>
            typeof entry === 'object' &&
            entry !== null &&
            typeof Reflect.get(entry, 'itemId') === 'string' &&
            typeof Reflect.get(entry, 'updatedAt') === 'number' &&
            typeof Reflect.get(entry, 'itemHash') === 'string',
          )
          .map((entry) => [entry.itemId, entry]),
      );

      const localMissingOrStaleForRemote = localItems.filter((item) => {
        const remoteEntry = remoteSummaryById.get(item.id);
        if (!remoteEntry) {
          return true;
        }
        const localHash = buildItemHash(item);
        if (localHash === remoteEntry.itemHash) {
          return false;
        }
        // Only send if client has newer data (mirrors applyIncomingItems logic)
        if (item.updatedAt > remoteEntry.updatedAt) {
          return true;
        }
        if (item.updatedAt < remoteEntry.updatedAt) {
          return false;
        }
        // Tie-breaker: same updatedAt, send if client hash >= server hash
        return localHash >= remoteEntry.itemHash;
      });

      if (localMissingOrStaleForRemote.length > 0) {
        this.send({ type: 'item_patch', listId, items: localMissingOrStaleForRemote });
      }

      this.onListExchangeComplete(listId);
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

    if (payload.type === 'list_metadata_patch') {
      const listId = typeof payload.listId === 'string' ? payload.listId : null;
      const listName = typeof payload.name === 'string' ? payload.name : null;
      const listUpdatedAt = typeof payload.updatedAt === 'number' ? payload.updatedAt : null;
      if (listId && listName && listUpdatedAt !== null) {
        await this.callbacks?.applyIncomingListMetadata(listId, {
          name: listName,
          updatedAt: listUpdatedAt,
        });
      }
      return;
    }

    if (payload.type === 'error') {
      const message = typeof payload.message === 'string' ? payload.message : 'sync error';
      if (message === 'forbidden') {
        this.isSubscribedReady = false;
        this.consecutiveForbiddenCount += 1;

        const listId = this.subscribedListId;
        if (!listId) {
          return;
        }

        // The backend rejects lists it has never seen — typically lists that
        // were created while offline. Register the list via REST once, then
        // retry the subscription.
        if (this.consecutiveForbiddenCount === 1 && this.callbacks) {
          const ensured = await this.callbacks.ensureListExists(listId);
          if (this.subscribedListId !== listId) {
            return;
          }
          if (!ensured && listId !== this.desiredListId) {
            this.onListExchangeComplete(listId);
            return;
          }
          this.send({ type: 'subscribe_list', listId });
          return;
        }

        // During a full sync pass an inaccessible list is skipped so the
        // remaining lists still get reconciled.
        if (listId !== this.desiredListId) {
          this.onListExchangeComplete(listId);
          return;
        }

        if (this.consecutiveForbiddenCount >= 3) {
          this.callbacks?.onError(message);
          this.onListExchangeComplete(listId);
          return;
        }

        this.send({ type: 'subscribe_list', listId });
        return;
      }

      if (message === 'not subscribed to list') {
        this.isSubscribedReady = false;
        if (this.subscribedListId) {
          this.send({ type: 'subscribe_list', listId: this.subscribedListId });
        }
        return;
      }

      this.callbacks?.onError(message);
    }
  }

  // After (re)connecting, every known list gets one reconciliation pass so
  // changes made offline — including on lists that are not currently open —
  // reach the backend without relying on the in-memory patch queue.
  private startFullSync() {
    if (!this.callbacks) {
      return;
    }

    this.fullSyncPending = false;
    const currentListId = this.subscribedListId;
    this.fullSyncQueue = this.callbacks.getAllListIds().filter((listId) => listId !== currentListId);
    if (currentListId === null) {
      this.advanceFullSync();
    }
  }

  private onListExchangeComplete(listId: string) {
    if (listId !== this.subscribedListId) {
      return;
    }

    this.clearFullSyncStepTimer();

    if (this.fullSyncPending) {
      this.startFullSync();
    }

    if (this.fullSyncQueue.length > 0 || this.subscribedListId !== this.desiredListId) {
      this.advanceFullSync();
    }
  }

  private advanceFullSync() {
    if (!this.socket || this.socket.readyState !== WebSocket.OPEN) {
      return;
    }

    // Lists can be deleted locally while the full sync is in flight.
    const knownListIds = new Set(this.callbacks?.getAllListIds() ?? []);
    let next: string | undefined;
    while ((next = this.fullSyncQueue.shift()) !== undefined) {
      if (knownListIds.has(next)) {
        break;
      }
    }

    const previousListId = this.subscribedListId;

    if (next === undefined) {
      if (this.subscribedListId === this.desiredListId) {
        return;
      }

      if (!this.desiredListId) {
        if (previousListId) {
          this.send({ type: 'unsubscribe_list', listId: previousListId });
        }
        this.subscribedListId = null;
        this.isSubscribedReady = false;
        return;
      }

      next = this.desiredListId;
    }

    this.subscribedListId = next;
    this.isSubscribedReady = false;
    this.consecutiveForbiddenCount = 0;
    if (previousListId && previousListId !== next) {
      this.send({ type: 'unsubscribe_list', listId: previousListId });
    }
    this.send({ type: 'subscribe_list', listId: next });
    this.armFullSyncStepTimer(next);
  }

  private armFullSyncStepTimer(listId: string) {
    this.clearFullSyncStepTimer();
    this.fullSyncStepTimer = window.setTimeout(() => {
      this.fullSyncStepTimer = null;
      this.onListExchangeComplete(listId);
    }, FULL_SYNC_STEP_TIMEOUT_MS);
  }

  private clearFullSyncStepTimer() {
    if (this.fullSyncStepTimer !== null) {
      window.clearTimeout(this.fullSyncStepTimer);
      this.fullSyncStepTimer = null;
    }
  }

  private cancelFullSync() {
    this.fullSyncPending = false;
    this.fullSyncQueue = [];
    this.clearFullSyncStepTimer();
    if (this.subscribedListId !== this.desiredListId) {
      this.subscribedListId = this.desiredListId;
      this.isSubscribedReady = false;
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

    if (!this.subscribedListId || !this.isSubscribedReady) {
      return;
    }

    const ready = this.queue.filter((entry) => entry.listId === this.subscribedListId);
    const readyMetadataPatches = this.listMetadataQueue.filter((entry) => entry.listId === this.subscribedListId);

    if (ready.length > 0) {
      this.queue = this.queue.filter((entry) => entry.listId !== this.subscribedListId);
      this.send({ type: 'item_patch', listId: this.subscribedListId, items: ready.map((entry) => entry.item) });
    }

    if (readyMetadataPatches.length > 0) {
      this.listMetadataQueue = this.listMetadataQueue.filter((entry) => entry.listId !== this.subscribedListId);
      const latestMetadataPatch = readyMetadataPatches.reduce((latest, entry) =>
        entry.updatedAt > latest.updatedAt ? entry : latest,
      );
      this.send({
        type: 'list_metadata_patch',
        listId: this.subscribedListId,
        name: latestMetadataPatch.name,
        updatedAt: latestMetadataPatch.updatedAt,
      });
    }
  }

  private send(payload: Record<string, unknown>) {
    if (!this.socket || this.socket.readyState !== WebSocket.OPEN) {
      return;
    }

    this.socket.send(JSON.stringify(payload));
  }
}

export const socketSyncManager = new SocketSyncManager();
