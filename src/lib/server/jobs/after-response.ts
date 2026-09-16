import { waitUntil } from "@vercel/functions";
import type { RequestEvent } from "@sveltejs/kit";

type DrainFn = (opts: {
  maxJobs?: number;
  deadlineMs?: number;
}) => Promise<unknown>;

/**
 * Schedule job drain after the response. On Vercel uses waitUntil;
 * locally fires without blocking the response.
 */
export function scheduleDrain(
  _event: RequestEvent | null,
  drain: DrainFn = async (opts) => {
    const { drainJobs } = await import("$lib/server/jobs/runner");
    return drainJobs(opts);
  },
  opts: { maxJobs?: number; deadlineMs?: number } = {
    maxJobs: 25,
    deadlineMs: 50_000,
  },
): void {
  const run = () =>
    drain(opts).catch((err) => {
      console.error("[jobs] scheduleDrain failed", err);
    });

  try {
    waitUntil(run());
  } catch {
    // Outside Vercel runtime (local vitest / node)
    void run();
  }
}
