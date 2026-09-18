import { defineConfig, devices } from "@playwright/test";
import { E2E_DEV_PORT } from "./scripts/dev/local-dev-port.mjs";

const previewPort = E2E_DEV_PORT;

export default defineConfig({
  testDir: "e2e",
  fullyParallel: false,
  workers: 1,
  timeout: 60_000,
  use: {
    baseURL: `http://localhost:${previewPort}`,
    trace: "on-first-retry",
    ...devices["Desktop Chrome"],
  },
  projects: [{ name: "pwa", testMatch: /pwa\.spec\.ts/ }],
  webServer: {
    command: `bun run build && bun run preview --port ${previewPort} --strictPort`,
    port: previewPort,
    reuseExistingServer: !process.env.CI,
    timeout: 300_000,
  },
});
