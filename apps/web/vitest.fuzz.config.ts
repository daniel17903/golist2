import { defineConfig } from "vitest/config";

// On-demand randomized sync fuzzing (sim/fuzz). Deliberately not part of
// `npm run test` or CI: run `npm run test:sync-fuzz` when you want it.
export default defineConfig({
  test: {
    name: "sync-fuzz",
    environment: "node",
    include: ["sim/fuzz/**/*.fuzz.test.ts"],
    setupFiles: ["sim/harness/setup.ts"],
    // Shrinking a failure re-runs many simulations.
    testTimeout: 30 * 60_000,
  },
});
