import type { SyncSocket } from "../../src/sharing/socketSync";
import { delay } from "./timers";

type Listener = (event: { data: unknown }) => void;

// Decides per frame whether it passes. Return false to drop it.
export type FrameFilter = (frame: Record<string, unknown>) => boolean;

const parseFrame = (data: string): Record<string, unknown> => {
  try {
    const parsed: unknown = JSON.parse(data);
    return typeof parsed === "object" && parsed !== null ? { ...parsed } : {};
  } catch {
    return {};
  }
};

const SOCKET_CONNECTING = 0;
const SOCKET_OPEN = 1;
const SOCKET_CLOSING = 2;
const SOCKET_CLOSED = 3;

/**
 * The network between one simulated device and the backend: REST (`fetch`)
 * and WebSocket traffic both pass through here, so a test can take a single
 * device offline, slow it down or drop specific frames without touching the
 * other devices or the server.
 */
export class DeviceNetwork {
  online = true;
  // Added to every REST call and to every frame in both directions.
  latencyMs = 0;
  // Frame filters; dropped frames are logged with `xx`.
  allowOutgoing: FrameFilter = () => true;
  allowIncoming: FrameFilter = () => true;
  readonly frameLog: string[] = [];
  private readonly sockets = new Set<ControlledSocket>();
  private readonly onlineListeners: Array<() => void> = [];

  constructor(
    readonly label: string,
    private readonly simTime: () => number,
  ) {}

  readonly fetch: typeof fetch = async (input, init) => {
    if (!this.online) {
      throw new TypeError("fetch failed (simulated offline)");
    }
    if (this.latencyMs > 0) {
      await delay(this.latencyMs);
    }
    const response = await fetch(input, init);
    if (!this.online) {
      throw new TypeError("fetch failed (simulated offline during request)");
    }
    return response;
  };

  readonly createSocket = (url: string): SyncSocket => {
    const socket = new ControlledSocket(url, this);
    this.sockets.add(socket);
    return socket;
  };

  // Wired to the sync manager's reconnect-now trigger (browser `online`).
  readonly onOnline = (listener: () => void) => {
    this.onlineListeners.push(listener);
  };

  goOffline() {
    this.online = false;
    this.record("--", "network offline");
    for (const socket of this.sockets) {
      socket.cutOff();
    }
  }

  goOnline() {
    this.online = true;
    this.record("--", "network online");
    this.onlineListeners.forEach((listener) => listener());
  }

  openSocketCount(): number {
    return [...this.sockets].filter((socket) => socket.readyState === SOCKET_OPEN).length;
  }

  record(direction: "->" | "<-" | "--" | "xx", text: string) {
    this.frameLog.push(`[${this.label} t=${this.simTime()}] ${direction} ${text}`);
  }

  forget(socket: ControlledSocket) {
    this.sockets.delete(socket);
  }
}

class ControlledSocket implements SyncSocket {
  readyState = SOCKET_CONNECTING;
  private readonly listeners = new Map<string, Listener[]>();
  private readonly native: WebSocket | null = null;
  private outbound: Promise<void> = Promise.resolve();
  private inbound: Promise<void> = Promise.resolve();

  constructor(
    url: string,
    private readonly network: DeviceNetwork,
  ) {
    if (!network.online) {
      // Like a browser without connectivity: the attempt fails asynchronously.
      setTimeout(() => {
        this.emit("error");
        this.finish("connect failed (offline)");
      }, 0);
      return;
    }

    const native = new WebSocket(url);
    this.native = native;
    native.addEventListener("open", () => {
      if (this.readyState !== SOCKET_CONNECTING) {
        return;
      }
      this.readyState = SOCKET_OPEN;
      network.record("--", "socket open");
      this.emit("open");
    });
    native.addEventListener("message", (event) => {
      const data = typeof event.data === "string" ? event.data : String(event.data);
      this.inbound = this.inbound
        .then(() => (network.latencyMs > 0 ? delay(network.latencyMs) : undefined))
        .then(() => {
          if (this.readyState !== SOCKET_OPEN) {
            return;
          }
          if (!network.allowIncoming(parseFrame(data))) {
            network.record("xx", `dropped incoming ${data}`);
            return;
          }
          network.record("<-", data);
          this.emit("message", { data });
        });
    });
    native.addEventListener("error", () => {
      if (this.readyState !== SOCKET_CLOSED) {
        this.emit("error");
      }
    });
    native.addEventListener("close", () => {
      // Let in-flight incoming frames land first, like a real close frame.
      void this.inbound.then(() => this.finish("socket closed"));
    });
  }

  addEventListener(type: "open" | "close" | "error", listener: () => void): void;
  addEventListener(type: "message", listener: (event: { data: unknown }) => void): void;
  addEventListener(type: string, listener: Listener): void {
    this.listeners.set(type, [...(this.listeners.get(type) ?? []), listener]);
  }

  send(data: string) {
    if (this.readyState !== SOCKET_OPEN) {
      return;
    }
    if (!this.network.allowOutgoing(parseFrame(data))) {
      this.network.record("xx", `dropped outgoing ${data}`);
      return;
    }
    this.network.record("->", data);
    const native = this.native;
    this.outbound = this.outbound
      .then(() => (this.network.latencyMs > 0 ? delay(this.network.latencyMs) : undefined))
      .then(() => {
        if (this.readyState === SOCKET_OPEN && native?.readyState === SOCKET_OPEN) {
          native.send(data);
        }
      });
  }

  close() {
    if (this.readyState === SOCKET_CLOSED || this.readyState === SOCKET_CLOSING) {
      return;
    }
    this.readyState = SOCKET_CLOSING;
    if (this.native) {
      this.native.close();
    } else {
      this.finish("closed by client");
    }
  }

  // Connectivity lost: the device sees the socket close right away.
  cutOff() {
    if (this.readyState === SOCKET_CLOSED) {
      return;
    }
    this.native?.close();
    this.finish("socket cut off (offline)");
  }

  private finish(reason: string) {
    if (this.readyState === SOCKET_CLOSED) {
      return;
    }
    this.readyState = SOCKET_CLOSED;
    this.network.record("--", reason);
    this.network.forget(this);
    this.emit("close");
  }

  private emit(type: string, event: { data: unknown } = { data: undefined }) {
    for (const listener of this.listeners.get(type) ?? []) {
      listener(event);
    }
  }
}
