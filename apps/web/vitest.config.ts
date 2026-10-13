import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    projects: [
      {
        test: {
          name: "unit",
          environment: "node",
          include: ["src/**/*.test.ts"],
        },
      },
      {
        // Multi-device sync simulation: real web store + sync client against
        // the real backend, in-process (see sim/README.md).
        test: {
          name: "sim",
          environment: "node",
          include: ["sim/**/*.sim.test.ts"],
          setupFiles: ["sim/harness/setup.ts"],
          testTimeout: 30_000,
        },
      },
    ],
  },
});
