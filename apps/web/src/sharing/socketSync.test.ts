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

  constructor(url: string) {
    this.url = url;
    FakeWebSocket.instances.push(this);
  }

  addEventListener(type: string, listener: Listener) {
    const existing = this.listeners.get(type) ?? [];
    this.listeners.set(type, [...existing, listener]);
  }

  send() {
    return undefined;
  }

  close() {
    this.readyState = FakeWebSocket.CLOSED;
    this.emit("close");
  }

  emit(type: string, event?: { data?: string }) {
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
});
