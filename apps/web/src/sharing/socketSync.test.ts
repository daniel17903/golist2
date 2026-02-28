import { afterEach, describe, expect, it, vi } from "vitest";

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

afterEach(() => {
  FakeWebSocket.instances = [];
  vi.unstubAllGlobals();
  vi.useRealTimers();
  vi.resetModules();
});

describe("socketSyncManager", () => {
  it("reconnects immediately when switching lists after socket closed", async () => {
    vi.useFakeTimers();
    vi.stubGlobal("__API_BASE_URL__", "http://localhost:3000");
    vi.stubGlobal("__API_TIMEOUT_MS__", "4000");
    vi.stubGlobal("WebSocket", FakeWebSocket);
    vi.stubGlobal("window", {
      addEventListener: () => undefined,
      setTimeout: globalThis.setTimeout.bind(globalThis),
      clearTimeout: globalThis.clearTimeout.bind(globalThis),
    });

    const { socketSyncManager } = await import("./socketSync");

    socketSyncManager.init("device-1", {
      getItemsForList: () => [],
      applyIncomingItems: async () => undefined,
      applyIncomingListMetadata: async () => undefined,
      onConnectionState: () => undefined,
      onError: () => undefined,
    });

    expect(FakeWebSocket.instances).toHaveLength(1);

    FakeWebSocket.instances[0]?.emit("close");
    socketSyncManager.setActiveList("list-1");

    expect(FakeWebSocket.instances).toHaveLength(2);
  });

  it("ignores close events from stale sockets while a newer socket is active", async () => {
    vi.useFakeTimers();
    vi.stubGlobal("__API_BASE_URL__", "http://localhost:3000");
    vi.stubGlobal("__API_TIMEOUT_MS__", "4000");
    vi.stubGlobal("WebSocket", FakeWebSocket);
    vi.stubGlobal("window", {
      addEventListener: () => undefined,
      setTimeout: globalThis.setTimeout.bind(globalThis),
      clearTimeout: globalThis.clearTimeout.bind(globalThis),
    });

    const onConnectionState = vi.fn();
    const { socketSyncManager } = await import("./socketSync");

    socketSyncManager.init("device-1", {
      getItemsForList: () => [],
      applyIncomingItems: async () => undefined,
      applyIncomingListMetadata: async () => undefined,
      onConnectionState,
      onError: () => undefined,
    });

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
    vi.useFakeTimers();
    vi.stubGlobal("__API_BASE_URL__", "http://localhost:3000");
    vi.stubGlobal("__API_TIMEOUT_MS__", "4000");
    vi.stubGlobal("WebSocket", FakeWebSocket);
    vi.stubGlobal("window", {
      addEventListener: () => undefined,
      setTimeout: globalThis.setTimeout.bind(globalThis),
      clearTimeout: globalThis.clearTimeout.bind(globalThis),
    });

    const { socketSyncManager } = await import("./socketSync");

    socketSyncManager.init("device-1", {
      getItemsForList: () => [],
      applyIncomingItems: async () => undefined,
      applyIncomingListMetadata: async () => undefined,
      onConnectionState: () => undefined,
      onError: () => undefined,
    });

    const socket = FakeWebSocket.instances[0];
    socket?.emit("open");
    socketSyncManager.setActiveList("list-1");
    socket!.sent = [];

    socketSyncManager.requestResync();

    expect(socket?.sent.some((frame) => frame.includes('"type":"list_digest"'))).toBe(false);
  });

  it("re-subscribes when backend reports not subscribed instead of surfacing an offline error", async () => {
    vi.useFakeTimers();
    vi.stubGlobal("__API_BASE_URL__", "http://localhost:3000");
    vi.stubGlobal("__API_TIMEOUT_MS__", "4000");
    vi.stubGlobal("WebSocket", FakeWebSocket);
    vi.stubGlobal("window", {
      addEventListener: () => undefined,
      setTimeout: globalThis.setTimeout.bind(globalThis),
      clearTimeout: globalThis.clearTimeout.bind(globalThis),
    });

    const onError = vi.fn();
    const { socketSyncManager } = await import("./socketSync");

    socketSyncManager.init("device-1", {
      getItemsForList: () => [],
      applyIncomingItems: async () => undefined,
      applyIncomingListMetadata: async () => undefined,
      onConnectionState: () => undefined,
      onError,
    });

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

  it("schedules reconnect when websocket errors without a close event", async () => {
    vi.useFakeTimers();
    vi.stubGlobal("__API_BASE_URL__", "http://localhost:3000");
    vi.stubGlobal("__API_TIMEOUT_MS__", "4000");
    vi.stubGlobal("WebSocket", FakeWebSocket);
    vi.stubGlobal("window", {
      addEventListener: () => undefined,
      setTimeout: globalThis.setTimeout.bind(globalThis),
      clearTimeout: globalThis.clearTimeout.bind(globalThis),
    });

    const { socketSyncManager } = await import("./socketSync");

    socketSyncManager.init("device-1", {
      getItemsForList: () => [],
      applyIncomingItems: async () => undefined,
      applyIncomingListMetadata: async () => undefined,
      onConnectionState: () => undefined,
      onError: () => undefined,
    });

    expect(FakeWebSocket.instances).toHaveLength(1);

    FakeWebSocket.instances[0]?.emit("error");
    vi.advanceTimersByTime(3000);

    expect(FakeWebSocket.instances).toHaveLength(2);
  });

});
