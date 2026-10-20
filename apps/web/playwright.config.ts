import { defineConfig, devices } from "@playwright/test";
import { backendLogPath } from "./e2e/support/paths";

// Full-stack E2E suite: a real Chromium drives the Vite-served web app, which
// talks to the real Fastify backend (REST + WebSocket sync). See
// e2e/support/backend-server.ts for the backend storage modes.
const backendPort = Number(process.env.E2E_BACKEND_PORT ?? 3100);
const webPort = Number(process.env.E2E_WEB_PORT ?? 4173);
const backendUrl = `http://127.0.0.1:${backendPort}`;
const webUrl = `http://127.0.0.1:${webPort}`;
const isCI = Boolean(process.env.CI);
// Agent containers often ship a preinstalled Chromium whose build differs
// from the one the pinned Playwright expects; scripts/agent-setup.sh exports
// this so the suite runs without downloading a browser.
const chromiumExecutable = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE || undefined;

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: isCI,
  retries: isCI ? 1 : 0,
  workers: isCI ? 2 : undefined,
  timeout: 30_000,
  expect: { timeout: 7_500 },
  reporter: isCI
    ? [["list"], ["github"], ["html", { open: "never" }]]
    : [["list"], ["json", { outputFile: "test-results/results.json" }]],
  use: {
    baseURL: webUrl,
    locale: "en-US",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    ...devices["Pixel 7"],
    // Pixel 7 defaults to touch + mobile; keep mouse pointer events so
    // long-press/short-press on item cards behave like they do in tests of
    // the pointer handlers, while still using a phone-sized viewport.
    hasTouch: false,
    isMobile: false,
    browserName: "chromium",
    launchOptions: chromiumExecutable ? { executablePath: chromiumExecutable } : {},
  },
  projects: [{ name: "chromium" }],
  webServer: [
    {
      command: "npx tsx e2e/support/backend-server.ts",
      url: `${backendUrl}/health`,
      reuseExistingServer: !isCI,
      timeout: 60_000,
      env: {
        E2E_BACKEND_PORT: String(backendPort),
        E2E_BACKEND_LOG: backendLogPath,
      },
    },
    {
      // Via npm so the web workspace's own dev script serves the app.
      command: `npm run dev -- --host 127.0.0.1 --port ${webPort} --strictPort`,
      url: webUrl,
      reuseExistingServer: !isCI,
      timeout: 60_000,
      env: {
        API_BASE_URL: backendUrl,
        // Production UI: the non-production backend debug log panel overlays
        // the toast area and would intercept clicks meant for the app.
        ENVIRONMENT: "production",
      },
    },
  ],
});
