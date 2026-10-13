import { resolve } from "node:path";

// Backend log (Fastify JSON lines). The fixtures attach the slice written
// during a failing test. Kept outside test-results/, which Playwright wipes
// at the start of every run.
export const backendLogPath = resolve(import.meta.dirname, "../../.e2e-logs/backend.log");
