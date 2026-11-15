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
        "src/lib/money/ledger.ts",
        "src/lib/money/centavos.ts",
        "src/lib/money/status.ts",
        "src/lib/loans/interest-period-editor.ts",
      ],
      thresholds: {
        lines: 90,
        functions: 85,
        branches: 80,
        statements: 90,
      },
    },
  },
});
