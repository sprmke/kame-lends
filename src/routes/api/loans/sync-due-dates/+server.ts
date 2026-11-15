/**
 * Removed: due dates are now owned by the loan edit flow, which validates the
 * due date against every interest period. Bulk rewriting due dates from a
 * Settings button is not safe.
 */
import { json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";

export const POST: RequestHandler = async () =>
  json(
    {
      error:
        "This repair endpoint has been removed. Set the loan due date when editing the loan.",
    },
    { status: 410 },
  );
