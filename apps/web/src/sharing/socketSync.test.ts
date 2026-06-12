import { afterEach, describe, expect, it, vi } from "vitest";
import type { Item } from "@golist/shared/domain/types";

type Listener = (event?: { data?: string }) => void;

class FakeWebSocket {
  static readonly CONNECTING = 0;
  static readonly OPEN = 1;
  static readonly CLOSING = 2;
  static readonly CLOSED = 3;
  static instances: FakeWebSocket[] = [];

  readonly url: string;
  readyState = FakeWebSocket.CONNECTING;
  private listeners = new Map<string, Listener[]>();
  sent: string[] = [];

  constructor(url: string) {
    this.url = url;
    FakeWebSocket.instances.push(this);
  }

  addEventListener(type: string, listener: Listener) {
    const existing = this.listeners.get(type) ?? [];
    this.listeners.set(type, [...existing, listener]);
  }

  send(payload?: string) {
    if (typeof payload === "string") {
      this.sent.push(payload);
    }
    return undefined;
  }

  close() {
    this.readyState = FakeWebSocket.CLOSED;
    this.emit("close");
  }

  emit(type: string, event?: { data?: string }) {
    if (type === "open") {
      this.readyState = FakeWebSocket.OPEN;
    }

    if (type === "close") {
      this.readyState = FakeWebSocket.CLOSED;
    }

    for (const listener of this.listeners.get(type) ?? []) {
      listener(event);
    }
  }
}

const stubEnvironment = () => {
  vi.useFakeTimers();
  vi.stubGlobal("__API_BASE_URL__", "http://localhost:3000");
  vi.stubGlobal("__API_TIMEOUT_MS__", "4000");
  vi.stubGlobal("WebSocket", FakeWebSocket);
  vi.stubGlobal("window", {
    addEventListener: () => undefined,
    setTimeout: globalThis.setTimeout.bind(globalThis),
    clearTimeout: globalThis.clearTimeout.bind(globalThis),
  });
};

const createCallbacks = () => ({
  getItemsForList: (): Item[] => [],
  getAllListIds: (): string[] => [],
  getListMetadata: () => null,
  ensureListExists: async () => true,
  applyIncomingItems: async () => undefined,
  applyIncomingListMetadata: async () => undefined,
  onConnectionState: () => undefined,
  onError: () => undefined,
});

const flushAsync = async () => {
  for (let i = 0; i < 5; i += 1) {
    await Promise.resolve();
  }
};

const buildItem = (id: string, listId: string): Item => ({
  id,
  listId,
  name: "Milk",
  iconName: "default",
  category: "other",
  deleted: false,
  createdAt: 1,
  updatedAt: 1,
});

const subscribedFrame = (listId: string) =>
  JSON.stringify({ type: "subscribed", listId, listName: "List", listUpdatedAt: 1, serverListDigest: "digest" });

const hashDiffFrame = (listId: string) => JSON.stringify({ type: "hash_diff", listId, summaries: [] });

afterEach(() => {
  FakeWebSocket.instances = [];
  vi.unstubAllGlobals();
  vi.useRealTimers();
  vi.resetModules();
});

describe("socketSyncManager", () => {
  it("reconnects immediately when switching lists after socket closed", async () => {
    stubEnvironment();

    const { socketSyncManager } = await import("./socketSync");

    socketSyncManager.init("device-1", createCallbacks());

    expect(FakeWebSocket.instances).toHaveLength(1);

    FakeWebSocket.instances[0]?.emit("close");
    socketSyncManager.setActiveList("list-1");

    expect(FakeWebSocket.instances).toHaveLength(2);
  });

  it("ignores close events from stale sockets while a newer socket is active", async () => {
    stubEnvironment();

    const onConnectionState = vi.fn();
    const { socketSyncManager } = await import("./socketSync");

    socketSyncManager.init("device-1", { ...createCallbacks(), onConnectionState });

    const firstSocket = FakeWebSocket.instances[0];
    socketSyncManager.forceReconnect();
    const secondSocket = FakeWebSocket.instances[1];

    expect(secondSocket).toBeDefined();

    secondSocket?.emit("open");
    onConnectionState.mockClear();

    firstSocket?.emit("close");

    expect(onConnectionState).not.toHaveBeenCalled();
  });


  it("does not send digest before subscription is acknowledged", async () => {
    stubEnvironment();

    const { socketSyncManager } = await import("./socketSync");

    socketSyncManager.init("device-1", createCallbacks());

    const socket = FakeWebSocket.instances[0];
    socket?.emit("open");
    socketSyncManager.setActiveList("list-1");
    socket!.sent = [];

    socketSyncManager.requestResync();

    expect(socket?.sent.some((frame) => frame.includes('"type":"list_digest"'))).toBe(false);
  });

  it("re-subscribes when backend reports not subscribed instead of surfacing an offline error", async () => {
    stubEnvironment();

    const onError = vi.fn();
    const { socketSyncManager } = await import("./socketSync");

    socketSyncManager.init("device-1", { ...createCallbacks(), onError });

    const socket = FakeWebSocket.instances[0];
    socket?.emit("open");
    socketSyncManager.setActiveList("list-1");
    socket!.sent = [];

    socket?.emit("message", {
      data: JSON.stringify({ type: "error", message: "not subscribed to list" }),
    });

    expect(onError).not.toHaveBeenCalled();
    expect(socket?.sent.some((frame) => frame.includes('"type":"subscribe_list"') && frame.includes('"listId":"list-1"'))).toBe(true);
  });


  it("registers the list via REST and retries when the first subscription is forbidden", async () => {
    stubEnvironment();

    const onError = vi.fn();
    const ensureListExists = vi.fn(async () => true);
    const { socketSyncManager } = await import("./socketSync");

    socketSyncManager.init("device-1", { ...createCallbacks(), ensureListExists, onError });

    const socket = FakeWebSocket.instances[0];
    socket?.emit("open");
    socketSyncManager.setActiveList("list-1");
    socket!.sent = [];

    socket?.emit("message", {
      data: JSON.stringify({ type: "error", message: "forbidden" }),
    });
    await flushAsync();

    expect(onError).not.toHaveBeenCalled();
    expect(ensureListExists).toHaveBeenCalledWith("list-1");
    expect(socket?.sent.some((frame) => frame.includes('"type":"subscribe_list"') && frame.includes('"listId":"list-1"'))).toBe(true);
  });

  it("surfaces forbidden after repeated failures", async () => {
    stubEnvironment();

    const onError = vi.fn();
    const { socketSyncManager } = await import("./socketSync");

    socketSyncManager.init("device-1", { ...createCallbacks(), onError });

    const socket = FakeWebSocket.instances[0];
    socket?.emit("open");
    socketSyncManager.setActiveList("list-1");

    socket?.emit("message", { data: JSON.stringify({ type: "error", message: "forbidden" }) });
    await flushAsync();
    socket?.emit("message", { data: JSON.stringify({ type: "error", message: "forbidden" }) });
    await flushAsync();
    socket?.emit("message", { data: JSON.stringify({ type: "error", message: "forbidden" }) });
    await flushAsync();

    expect(onError).toHaveBeenCalledTimes(1);
    expect(onError).toHaveBeenCalledWith("forbidden");
  });

  it("schedules reconnect when websocket errors without a close event", async () => {
    stubEnvironment();

    const { socketSyncManager } = await import("./socketSync");

    socketSyncManager.init("device-1", createCallbacks());

    expect(FakeWebSocket.instances).toHaveLength(1);

    FakeWebSocket.instances[0]?.emit("error");
    vi.advanceTimersByTime(3000);

    expect(FakeWebSocket.instances).toHaveLength(2);
  });

  it("reconciles every known list after connecting and returns to the active list", async () => {
    stubEnvironment();

    const { socketSyncManager } = await import("./socketSync");

    socketSyncManager.init("device-1", {
      ...createCallbacks(),
      getAllListIds: () => ["list-1", "list-2"],
    });

    socketSyncManager.setActiveList("list-1");
    const socket = FakeWebSocket.instances[0];
    socket?.emit("open");

    socket?.emit("message", { data: subscribedFrame("list-1") });
    await flushAsync();
    socket!.sent = [];
    socket?.emit("message", { data: hashDiffFrame("list-1") });
    await flushAsync();

    expect(socket?.sent.some((frame) => frame.includes('"type":"subscribe_list"') && frame.includes('"listId":"list-2"'))).toBe(true);

    socket?.emit("message", { data: subscribedFrame("list-2") });
    await flushAsync();
    socket!.sent = [];
    socket?.emit("message", { data: hashDiffFrame("list-2") });
    await flushAsync();

    expect(socket?.sent.some((frame) => frame.includes('"type":"subscribe_list"') && frame.includes('"listId":"list-1"'))).toBe(true);
  });

  it("flushes queued patches for a non-active list during the full sync pass", async () => {
    stubEnvironment();

    const { socketSyncManager } = await import("./socketSync");

    socketSyncManager.init("device-1", {
      ...createCallbacks(),
      getAllListIds: () => ["list-1", "list-2"],
    });

    socketSyncManager.setActiveList("list-1");
    socketSyncManager.queueLocalItemPatch(buildItem("item-7", "list-2"));

    const socket = FakeWebSocket.instances[0];
    socket?.emit("open");
    socket?.emit("message", { data: subscribedFrame("list-1") });
    await flushAsync();
    socket?.emit("message", { data: hashDiffFrame("list-1") });
    await flushAsync();

    socket!.sent = [];
    socket?.emit("message", { data: subscribedFrame("list-2") });
    await flushAsync();

    expect(
      socket?.sent.some((frame) => frame.includes('"type":"item_patch"') && frame.includes('"item-7"')),
    ).toBe(true);
  });

  it("pushes the local list name to the backend when it is newer", async () => {
    stubEnvironment();

    const { socketSyncManager } = await import("./socketSync");

    socketSyncManager.init("device-1", {
      ...createCallbacks(),
      getListMetadata: () => ({ name: "Renamed offline", updatedAt: 2000 }),
    });

    socketSyncManager.setActiveList("list-1");
    const socket = FakeWebSocket.instances[0];
    socket?.emit("open");
    socket!.sent = [];

    socket?.emit("message", {
      data: JSON.stringify({
        type: "subscribed",
        listId: "list-1",
        listName: "Old name",
        listUpdatedAt: 1000,
        serverListDigest: "digest",
      }),
    });
    await flushAsync();

    expect(
      socket?.sent.some(
        (frame) => frame.includes('"type":"list_metadata_patch"') && frame.includes('"Renamed offline"'),
      ),
    ).toBe(true);
  });

  it("skips inaccessible lists during the full sync pass", async () => {
    stubEnvironment();

    const { socketSyncManager } = await import("./socketSync");

    socketSyncManager.init("device-1", {
      ...createCallbacks(),
      ensureListExists: async () => false,
      getAllListIds: () => ["list-1", "list-2", "list-3"],
    });

    socketSyncManager.setActiveList("list-1");
    const socket = FakeWebSocket.instances[0];
    socket?.emit("open");
    socket?.emit("message", { data: subscribedFrame("list-1") });
    await flushAsync();
    socket?.emit("message", { data: hashDiffFrame("list-1") });
    await flushAsync();

    socket!.sent = [];
    socket?.emit("message", { data: JSON.stringify({ type: "error", message: "forbidden" }) });
    await flushAsync();

    expect(socket?.sent.some((frame) => frame.includes('"type":"subscribe_list"') && frame.includes('"listId":"list-3"'))).toBe(true);
  });
});
