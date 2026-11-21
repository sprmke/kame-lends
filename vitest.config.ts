import { defineConfig } from "vitest/config";
import { sveltekit } from "@sveltejs/kit/vite";

export default defineConfig({
  plugins: [sveltekit()],
  test: {
    include: ["src/**/*.{test,spec}.{js,ts}"],
    exclude: ["**/node_modules/**", "**/*.integration.test.ts"],
    coverage: {
      provider: "v8",
      include: [
        "src/lib/money/**/*.ts",
        "src/lib/loans/**/*.ts",
        "src/lib/dates/**/*.ts",
        "src/lib/schemas/**/*.ts",
      ],
      exclude: ["**/*.test.ts"],
      thresholds: {
        lines: 75,
        functions: 80,
        branches: 65,
        statements: 75,
      },
    },
  },
});
