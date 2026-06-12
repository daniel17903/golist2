import type { Item } from '@golist/shared/domain/types';
import { buildItemHash, buildItemSummaries, buildListDigest } from '@golist/shared/domain/sync';

import { isBackendSharingEnabled } from './apiClient';

export type SocketSyncCallbacks = {
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

type ItemSummary = { itemId: string; updatedAt: number; itemHash: string };

// Incoming frames decoded into a discriminated union, so the handlers below
// work with validated data instead of raw `unknown` payloads.
type ServerMessage =
  | { type: 'subscribed'; listId: string; listName: string | null; listUpdatedAt: number | null }
  | { type: 'hash_diff'; listId: string; summaries: ItemSummary[] }
  | { type: 'item_patch'; listId: string; items: Item[] }
  | { type: 'list_metadata_patch'; listId: string; name: string; updatedAt: number }
  | { type: 'error'; message: string };

const isItemSummary = (value: unknown): value is ItemSummary =>
  typeof value === 'object' &&
  value !== null &&
  typeof Reflect.get(value, 'itemId') === 'string' &&
  typeof Reflect.get(value, 'updatedAt') === 'number' &&
  typeof Reflect.get(value, 'itemHash') === 'string';

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

const parseServerMessage = (value: unknown): ServerMessage | null => {
  if (!isMessagePayload(value)) {
    return null;
  }

  if (value.type === 'subscribed') {
    const listId = typeof value.listId === 'string' ? value.listId : null;
    if (!listId) {
      return null;
    }
    return {
      type: 'subscribed',
      listId,
      listName: typeof value.listName === 'string' ? value.listName : null,
      listUpdatedAt: typeof value.listUpdatedAt === 'number' ? value.listUpdatedAt : null,
    };
  }

  if (value.type === 'hash_diff') {
    const listId = typeof value.listId === 'string' ? value.listId : null;
    if (!listId) {
      return null;
    }
    const summaries = Array.isArray(value.summaries) ? value.summaries.filter(isItemSummary) : [];
    return { type: 'hash_diff', listId, summaries };
  }

  if (value.type === 'item_patch') {
    const listId = typeof value.listId === 'string' ? value.listId : null;
    if (!listId) {
      return null;
    }
    const items = Array.isArray(value.items) ? value.items.filter((entry) => isSyncItem(entry)) : [];
    return { type: 'item_patch', listId, items };
  }

  if (value.type === 'list_metadata_patch') {
    const listId = typeof value.listId === 'string' ? value.listId : null;
    const name = typeof value.name === 'string' ? value.name : null;
    const updatedAt = typeof value.updatedAt === 'number' ? value.updatedAt : null;
    if (!listId || !name || updatedAt === null) {
      return null;
    }
    return { type: 'list_metadata_patch', listId, name, updatedAt };
  }

  if (value.type === 'error') {
    return {
      type: 'error',
      message: typeof value.message === 'string' ? value.message : 'sync error',
    };
  }

  return null;
};

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

    let parsed: unknown;
    try {
      parsed = JSON.parse(rawData);
    } catch {
      return;
    }

    const message = parseServerMessage(parsed);
    if (!message) {
      return;
    }

    switch (message.type) {
      case 'subscribed':
        await this.handleSubscribedMessage(message.listId, message.listName, message.listUpdatedAt);
        return;
      case 'hash_diff':
        this.handleHashDiffMessage(message.listId, message.summaries);
        return;
      case 'item_patch':
        await this.handleItemPatchMessage(message.listId, message.items);
        return;
      case 'list_metadata_patch':
        await this.handleListMetadataPatchMessage(message.listId, message.name, message.updatedAt);
        return;
      case 'error':
        await this.handleErrorMessage(message.message);
    }
  }

  private async handleSubscribedMessage(listId: string, listName: string | null, listUpdatedAt: number | null) {
    if (listId !== this.subscribedListId) {
      return;
    }

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

  private handleHashDiffMessage(listId: string, remoteSummaries: ItemSummary[]) {
    if (!this.callbacks || listId !== this.subscribedListId) {
      return;
    }

    const localItems = this.callbacks.getItemsForList(listId);
    const localSummaries = buildItemSummaries(localItems);
    this.send({ type: 'hash_diff', listId, summaries: localSummaries });

    const remoteSummaryById = new Map(remoteSummaries.map((entry) => [entry.itemId, entry]));

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
  }

  private async handleItemPatchMessage(listId: string, items: Item[]) {
    if (items.length > 0) {
      await this.callbacks?.applyIncomingItems(listId, items);
    }
  }

  private async handleListMetadataPatchMessage(listId: string, name: string, updatedAt: number) {
    await this.callbacks?.applyIncomingListMetadata(listId, { name, updatedAt });
  }

  private async handleErrorMessage(message: string) {
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

  // After (re)connecting, every known list gets one reconciliation pass so
  // changes made offline — including on lists that are not currently open —
  // reach the backend without relying on the in-memory patch queue.
  //
  // Full-sync state machine:
  // - `desiredListId` is the list the UI wants subscribed; `subscribedListId`
  //   is the list the socket is currently working through (during a full sync
  //   they temporarily diverge while background lists are reconciled).
  // - `fullSyncPending` is set on socket open and converts into a populated
  //   `fullSyncQueue` once the first list exchange completes.
  // - Each queue step subscribes one list and ends via
  //   `onListExchangeComplete` — either a finished hash_diff exchange, a
  //   skipped forbidden list, or the `fullSyncStepTimer` timeout.
  // - When the queue drains, the subscription returns to `desiredListId`;
  //   `cancelFullSync` (socket close) abandons the pass entirely.
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
