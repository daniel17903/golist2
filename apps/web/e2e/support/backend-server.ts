// Boots the real Fastify backend for the Playwright E2E suite.
//
// E2E_BACKEND=memory (default) uses the in-memory repository so the suite
// runs without any database. E2E_BACKEND=postgres uses the production
// Postgres repository (configure it via the usual PG* env vars) and applies
// migrations first, so the full stack — browser, Vite app, Fastify, Postgres —
// is exercised end to end.
import { buildServer } from "../../../backend/src/server.js";
import { InMemoryListRepository } from "../../../backend/src/test/in-memory-list-repository.js";

const port = Number(process.env.E2E_BACKEND_PORT ?? 3100);
const mode = process.env.E2E_BACKEND ?? "memory";

const start = async () => {
  if (mode === "postgres") {
    const { runMigrations } = await import("../../../backend/src/db/migrate.js");
    const applied = await runMigrations();
    console.info(`[e2e-backend] applied ${applied} migration(s)`);
  } else if (mode !== "memory") {
    throw new Error(`Unknown E2E_BACKEND mode: ${mode}`);
  }

  const app = buildServer(mode === "memory" ? { listRepository: new InMemoryListRepository() } : {});
  await app.listen({ host: "127.0.0.1", port });
  console.info(`[e2e-backend] listening on http://127.0.0.1:${port} (${mode})`);

  const shutdown = () => {
    void app.close().finally(() => process.exit(0));
  };
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
};

start().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
