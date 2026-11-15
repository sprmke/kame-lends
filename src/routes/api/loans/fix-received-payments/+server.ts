/**
 * Removed: this endpoint created payment rows with no receipt and deleted real
 * unlinked payments. It is replaced by the read-only money health report
 * (`scripts/db/money-health-report.ts`, `GET /api/admin/money-health`).
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
