/**
 * Removed: this endpoint also created payments and deleted real ones.
 * Data health is read-only now (see `scripts/db/money-health-report.ts`).
 */
import { json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";

export const POST: RequestHandler = async () =>
  json(
    {
      error:
        "This repair endpoint has been removed. Use the read-only Data health report instead.",
    },
    { status: 410 },
  );
