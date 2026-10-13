import type { SyncItemSnapshot } from "@golist/shared/domain/sync";
import { buildServer } from "../../../backend/src/server.js";
import type { ListRepository } from "../../../backend/src/repositories/list-repository.js";
import { InMemoryListRepository } from "../../../backend/src/test/in-memory-list-repository.js";

type FastifyApp = ReturnType<typeof buildServer>;

export type ServerListSnapshot = { name: string; items: SyncItemSnapshot[] };

/**
 * The real Fastify backend (REST + WebSocket sync) on a free local port.
 * `restart()` simulates a deploy/crash: every socket drops, the repository
 * (the "database") survives, and the server comes back on the same port.
 */
export class SimServer {
  private app: FastifyApp | null = null;
  private port = 0;

  private constructor(readonly repository: ListRepository) {}

  static async start(repository: ListRepository = new InMemoryListRepository()) {
    const server = new SimServer(repository);
    await server.listen();
    return server;
  }

  get httpUrl() {
    return `http://127.0.0.1:${this.port}`;
  }

  get wsUrl() {
    return `ws://127.0.0.1:${this.port}/v1/ws`;
  }

  get isRunning() {
    return this.app !== null;
  }

  async stop() {
    const app = this.app;
    this.app = null;
    await app?.close();
  }

  async restart(downtimeMs = 0) {
    await this.stop();
    if (downtimeMs > 0) {
      await new Promise((resolve) => setTimeout(resolve, downtimeMs));
    }
    await this.listen();
  }

  // Read straight from the repository: the server's view of the list.
  async listSnapshot(listId: string): Promise<ServerListSnapshot | null> {
    const list = await this.repository.getList(listId);
    if (!list) {
      return null;
    }
    const items = await this.repository.listItems(listId);
    return {
      name: list.name,
      items: items.map((item) => ({
        id: item.id,
        listId: item.listId,
        name: item.name,
        iconName: item.iconName,
        quantityOrUnit: item.quantityOrUnit,
        category: item.category,
        deleted: item.deleted,
        updatedAt: Date.parse(item.updatedAt),
      })),
    };
  }

  private async listen() {
    const app = buildServer({ listRepository: this.repository, logger: false });
    await app.listen({ host: "127.0.0.1", port: this.port });
    const address = app.server.address();
    if (address && typeof address === "object") {
      this.port = address.port;
    }
    this.app = app;
  }
}
