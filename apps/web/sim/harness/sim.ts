import { buildListDigest } from "@golist/shared/domain/sync";
import type { ListRepository } from "../../../backend/src/repositories/list-repository.js";
import { SimClock } from "./clock";
import { SimDevice } from "./device";
import { SimServer } from "./server";
import { waitUntil } from "./timers";

export type ConvergenceOptions = {
  // Defaults to every running, online device that knows the list.
  devices?: SimDevice[];
  timeoutMs?: number;
};

/**
 * A multi-device sync simulation: one real backend plus any number of
 * simulated devices running the real web store + sync client in-process.
 *
 *   const sim = await SyncSim.start();
 *   const { listId, devices: [a, b] } = await sim.sharedList(2);
 *   a.goOffline(); await a.addItem("milk"); a.goOnline();
 *   await sim.waitForConvergence(listId);
 *   await sim.dispose();
 *
 * Failures include every device's lists, items and recent sync frames.
 */
export class SyncSim {
  readonly devices: SimDevice[] = [];

  private constructor(
    readonly server: SimServer,
    readonly clock: SimClock,
  ) {}

  static async start(options: { repository?: ListRepository; clock?: SimClock } = {}) {
    const server = await SimServer.start(options.repository);
    return new SyncSim(server, options.clock ?? new SimClock());
  }

  async device(name = `device-${String.fromCharCode(97 + this.devices.length)}`): Promise<SimDevice> {
    const device = await SimDevice.boot(name, this.server, this.clock);
    this.devices.push(device);
    return device;
  }

  /**
   * `count` devices sharing one list: the first creates and shares it, the
   * others join via the share token. Resolves once all of them are in sync.
   */
  async sharedList(count: number, listName = "Shared") {
    const owner = await this.device();
    const listId = await owner.createList(listName);
    await owner.waitUntilOnline();
    const token = await owner.share();
    const devices = [owner];
    for (let index = 1; index < count; index += 1) {
      const device = await this.device();
      await device.join(token);
      devices.push(device);
    }
    await this.waitForConvergence(listId, { devices });
    return { listId, token, devices };
  }

  /**
   * Waits until the server and every device agree on the list: same name
   * and the same item digest (ids, names, quantities, categories, icons,
   * deleted flags and timestamps of every item, checked off or not). Every
   * checked device must also be fully booted and connected (`isSyncing`).
   */
  async waitForConvergence(listId: string, options: ConvergenceOptions = {}) {
    const pick = () =>
      options.devices ??
      this.devices.filter((device) => device.network.online && device.isRunning && device.hasList(listId));
    await waitUntil(
      async () => {
        const server = await this.server.listSnapshot(listId);
        if (!server) {
          return false;
        }
        const serverDigest = buildListDigest(server.items);
        return pick().every((device) => {
          const snapshot = device.isSyncing ? device.snapshot(listId) : null;
          return snapshot !== null && snapshot.name === server.name && snapshot.digest === serverDigest;
        });
      },
      {
        timeoutMs: options.timeoutMs ?? 10_000,
        describe: async () => `devices did not converge on list ${listId}\n${await this.describe(listId)}`,
      },
    );
  }

  // Server state plus every device, for failure messages and debugging.
  async describe(listId?: string): Promise<string> {
    const lines: string[] = [];
    if (listId) {
      const server = await this.server.listSnapshot(listId);
      lines.push(`== server list ${listId}: ${server ? `"${server.name}"` : "missing"}`);
      for (const item of server?.items ?? []) {
        lines.push(
          `     - ${item.deleted ? "[x]" : "[ ]"} ${item.name}${item.quantityOrUnit ? ` (${item.quantityOrUnit})` : ""} @${item.updatedAt} ${item.id}`,
        );
      }
    }
    lines.push(...this.devices.map((device) => device.describe()));
    return lines.join("\n");
  }

  async dispose() {
    this.devices.forEach((device) => device.shutdown());
    await this.server.stop();
  }
}
