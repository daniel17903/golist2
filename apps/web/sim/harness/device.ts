import { IDBFactory, IDBKeyRange } from "fake-indexeddb";
import { buildListDigest } from "@golist/shared/domain/sync";
import type { Item } from "@golist/shared/domain/types";
import { createSharingApiClient } from "../../src/sharing/apiClient";
import { SocketSyncManager } from "../../src/sharing/socketSync";
import { createGoListStore, type GoListStore } from "../../src/state/useStore";
import { GoListDatabase } from "../../src/storage/db";
import type { SimClock } from "./clock";
import { DeviceNetwork } from "./network";
import type { SimServer } from "./server";
import { createNodeTimers, waitUntil } from "./timers";

export type DeviceListSnapshot = { name: string; items: Item[]; digest: string };

const createMapStorage = () => {
  const data = new Map<string, string>();
  return {
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => {
      data.set(key, value);
    },
    removeItem: (key: string) => {
      data.delete(key);
    },
  };
};

/**
 * One simulated GoList installation: the real web store, Dexie database (on
 * an isolated fake IndexedDB), REST client and WebSocket sync manager —
 * exactly the code the browser runs, minus React. IndexedDB and
 * localStorage survive `restart()`, like a reloaded PWA.
 *
 * The item helpers act on the device's *active* list and look items up by
 * name, mirroring what a user taps.
 */
export class SimDevice {
  readonly network: DeviceNetwork;
  private readonly storage = createMapStorage();
  private readonly indexedDB = new IDBFactory();
  private readonly timers = createNodeTimers();
  private db: GoListDatabase | null = null;
  private sync: SocketSyncManager | null = null;
  private currentStore: GoListStore | null = null;
  private restarts = 0;

  private constructor(
    readonly name: string,
    private readonly server: SimServer,
    private readonly clock: SimClock,
  ) {
    this.network = new DeviceNetwork(name, () => clock.peek());
  }

  static async boot(name: string, server: SimServer, clock: SimClock) {
    const device = new SimDevice(name, server, clock);
    await device.startApp();
    return device;
  }

  get isRunning(): boolean {
    return this.currentStore !== null;
  }

  // Booted and settled: the store starts its sync manager only after
  // hydrating every list from IndexedDB, and the manager must have its
  // active list subscribed (acknowledged) with no full-sync pass pending.
  // Before that a device can look "in sync" just because it has not loaded
  // or subscribed yet.
  get isSyncing(): boolean {
    return this.isRunning && this.state.backendConnection === "online" && (this.sync?.isSettled() ?? false);
  }

  get store(): GoListStore {
    if (!this.currentStore) {
      throw new Error(`device ${this.name} is not running`);
    }
    return this.currentStore;
  }

  get state() {
    return this.store.getState();
  }

  get deviceId(): string {
    const id = this.state.metadata?.deviceId;
    if (!id) {
      throw new Error(`device ${this.name} has no device id yet`);
    }
    return id;
  }

  get activeListId(): string {
    const id = this.state.activeListId;
    if (!id) {
      throw new Error(`device ${this.name} has no active list`);
    }
    return id;
  }

  // ---------- lifecycle ----------

  // Closes the app (sockets, timers, database) and starts it again from
  // what is persisted, like a PWA reload or OS process kill.
  async restart() {
    this.shutdown();
    this.network.record("--", "app restart");
    await this.startApp();
  }

  shutdown() {
    this.sync?.dispose();
    this.timers.clearAll();
    this.db?.close();
    this.sync = null;
    this.db = null;
    this.currentStore = null;
  }

  goOffline() {
    this.network.goOffline();
  }

  goOnline() {
    this.network.goOnline();
  }

  // Resolves once the device has an open, subscribed, settled sync socket.
  async waitUntilOnline(timeoutMs = 10_000) {
    await waitUntil(() => this.isSyncing, {
      timeoutMs,
      describe: () => `device ${this.name} did not come online\n${this.describe()}`,
    });
  }

  // ---------- lists ----------

  async createList(name: string): Promise<string> {
    await this.state.addList(name);
    return this.activeListId;
  }

  async renameActiveList(name: string) {
    await this.state.renameList(this.activeListId, name);
  }

  switchTo(listId: string) {
    this.state.setActiveList(listId);
  }

  async deleteList(listId: string) {
    await this.state.deleteList(listId);
  }

  // Creates a share token for the active list (needs the backend).
  async share(): Promise<string> {
    return this.state.ensureShareToken(this.activeListId);
  }

  async join(shareToken: string): Promise<string> {
    return this.state.joinSharedList(shareToken);
  }

  // ---------- items (active list) ----------

  async addItem(name: string, quantityOrUnit?: string) {
    await this.state.addItem(this.activeListId, name, quantityOrUnit);
  }

  // The newest item with this name in the active list, checked off or not.
  item(name: string): Item | undefined {
    return this.itemsOf(this.activeListId)
      .filter((item) => item.name === name)
      .sort((left, right) => right.updatedAt - left.updatedAt)[0];
  }

  private requireItem(name: string, deleted?: boolean): Item {
    const match = this.itemsOf(this.activeListId).find(
      (item) => item.name === name && (deleted === undefined || item.deleted === deleted),
    );
    if (!match) {
      throw new Error(`device ${this.name}: no ${deleted ? "checked-off " : ""}item "${name}" in the active list`);
    }
    return match;
  }

  async checkOff(name: string) {
    await this.state.toggleItem(this.requireItem(name, false).id);
  }

  async restore(name: string) {
    await this.state.toggleItem(this.requireItem(name, true).id);
  }

  async editItem(name: string, nextName: string, quantityOrUnit?: string) {
    await this.state.updateItem(this.requireItem(name).id, nextName, quantityOrUnit);
  }

  // ---------- inspection ----------

  itemsOf(listId: string): Item[] {
    return this.state.items.filter((item) => item.listId === listId);
  }

  // Names of the visible (not checked-off) items of a list, sorted.
  visibleItemNames(listId = this.activeListId): string[] {
    return this.itemsOf(listId)
      .filter((item) => !item.deleted)
      .map((item) => item.name)
      .sort();
  }

  hasList(listId: string): boolean {
    return this.state.lists.some((list) => list.id === listId);
  }

  snapshot(listId: string): DeviceListSnapshot | null {
    const list = this.state.lists.find((entry) => entry.id === listId);
    if (!list) {
      return null;
    }
    const items = this.itemsOf(listId);
    return { name: list.name, items, digest: buildListDigest(items) };
  }

  // Persisted (IndexedDB) items of a list, to check that what the UI shows
  // is also what survives a restart.
  async persistedItems(listId: string): Promise<Item[]> {
    if (!this.db) {
      throw new Error(`device ${this.name} is not running`);
    }
    return this.db.items.where("listId").equals(listId).toArray();
  }

  async persistedList(listId: string) {
    if (!this.db) {
      throw new Error(`device ${this.name} is not running`);
    }
    return this.db.lists.get(listId);
  }

  listName(listId = this.activeListId): string | undefined {
    return this.state.lists.find((list) => list.id === listId)?.name;
  }

  describe(frameLines = 40): string {
    const state = this.currentStore?.getState();
    const lines = [
      `== device ${this.name} (${this.network.online ? "online" : "OFFLINE"}, connection=${state?.backendConnection ?? "stopped"}, restarts=${this.restarts})`,
    ];
    for (const list of state?.lists ?? []) {
      const items = state?.items.filter((item) => item.listId === list.id) ?? [];
      lines.push(
        `   list ${list.id} "${list.name}" @${list.updatedAt}${list.id === state?.activeListId ? " (active)" : ""}`,
        ...items.map(
          (item) =>
            `     - ${item.deleted ? "[x]" : "[ ]"} ${item.name}${item.quantityOrUnit ? ` (${item.quantityOrUnit})` : ""} @${item.updatedAt} ${item.id}`,
        ),
      );
    }
    const errors = state?.backendLogs.filter((entry) => entry.outcome === "error") ?? [];
    if (errors.length > 0) {
      lines.push("   errors:", ...errors.slice(-5).map((entry) => `     ! ${entry.message}`));
    }
    lines.push(`   last ${frameLines} frames:`, ...this.network.frameLog.slice(-frameLines).map((line) => `     ${line}`));
    return lines.join("\n");
  }

  private async startApp() {
    this.restarts += 1;
    const db = new GoListDatabase(`golist-${this.name}`, { indexedDB: this.indexedDB, IDBKeyRange });
    const api = createSharingApiClient({
      baseUrl: this.server.httpUrl,
      timeoutMs: 5_000,
      fetch: this.network.fetch,
    });
    const sync = new SocketSyncManager({
      resolveUrl: () => this.server.wsUrl,
      createSocket: this.network.createSocket,
      timers: this.timers,
      onOnline: this.network.onOnline,
      // Much shorter than production (3s/10s) so reconnects don't dominate
      // test time; the state machine is the same.
      reconnectDelaysMs: [50, 200],
      fullSyncStepTimeoutMs: 2_000,
    });
    const store = createGoListStore({
      db,
      api: api.client,
      isBackendSharingEnabled: true,
      setBackendCallLogger: api.setBackendCallLogger,
      setActiveBackendRequestLogger: api.setActiveBackendRequestLogger,
      sync,
      storage: this.storage,
      now: this.clock.now,
      createId: () => crypto.randomUUID(),
      appVersion: "sim",
    });
    this.db = db;
    this.sync = sync;
    this.currentStore = store;
    await store.getState().load();
  }
}
