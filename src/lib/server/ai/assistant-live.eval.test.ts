import { describe, expect, it } from "vitest";

const enabled = process.env.RUN_ASSISTANT_EVALS === "1";

/**
 * Live assistant evals. Skipped by default so CI stays offline and free.
 *
 *   RUN_ASSISTANT_EVALS=1 GEMINI_API_KEY=… bunx vitest run \
 *     src/lib/server/ai/assistant-live.eval.test.ts
 */
describe.skipIf(!enabled)("assistant evals (live)", () => {
  it(
    "scores tool selection and red-team containment",
    async () => {
      const { runLive } =
        await import("../../../../scripts/evals/run-assistant-evals");
      const results = await runLive({ runs: 1, suite: "all" });
      expect(results.length).toBeGreaterThan(0);
      const failed = results.filter((row) => row.passed !== true);
      expect(failed).toEqual([]);
    },
    15 * 60 * 1000,
  );
});
