import { defineConfig } from "vitest/config";
import { sveltekit } from "@sveltejs/kit/vite";

/**
 * Database integration tests. They need local Docker Postgres (`./dev.sh` or
 * `bun run db:local:start`) and the prod snapshot restored with
 * `bun run db:local:sync-prod`. They must never point at Neon production.
 */
export default defineConfig({
  plugins: [sveltekit()],
  test: {
    include: ["src/**/*.integration.test.ts"],
    fileParallelism: false,
    testTimeout: 30_000,
    hookTimeout: 60_000,
    setupFiles: ["./src/lib/server/test/integration-setup.ts"],
  },
});
