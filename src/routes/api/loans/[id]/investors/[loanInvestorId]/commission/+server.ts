import { json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { getSession } from "$lib/server/session";
import {
  hasMyCommissionAccess,
  upsertUserCommission,
} from "$lib/server/loan-user-commission";
import { invalidateLoanData } from "$lib/server/cache-invalidation";

/** @deprecated Use PATCH /api/loans/[id]/my-commission */
export const PATCH: RequestHandler = async (event) => {
  const { params, request } = event;
  try {
    const session = await getSession(event);
    if (!session?.user?.id) {
      return json({ error: "Unauthorized" }, { status: 401 });
    }

    const loanId = Number.parseInt(params.id, 10);
    if (!Number.isFinite(loanId)) {
      return json({ error: "Invalid loan ID." }, { status: 400 });
    }

    const allowed = await hasMyCommissionAccess(loanId, session.user.id);
    if (!allowed) {
      return json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();
    const profitType = body.profitType === "fixed" ? "fixed" : "rate";
    const profitValue = Number.parseFloat(String(body.profitValue));

    if (!Number.isFinite(profitValue) || profitValue < 0) {
      return json(
        { error: "Enter a commission amount of zero or more." },
        { status: 400 },
      );
    }

    await upsertUserCommission(loanId, session.user.id, {
      profitType,
      profitValue: String(profitValue),
    });

    invalidateLoanData();
    return json({ success: true });
  } catch (error) {
    console.error("Error updating commission:", error);
    return json({ error: "Failed to update commission." }, { status: 500 });
  }
};
