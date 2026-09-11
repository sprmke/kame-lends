import { json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { eq } from "drizzle-orm";
import { getSession } from "$lib/server/session";
import { db } from "$lib/server/db";
import { loans } from "$lib/server/db/schema";
import { hasBorrowerProfitWriteAccess } from "$lib/server/access-control";
import { invalidateLoanData } from "$lib/server/cache-invalidation";

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

    const allowed = await hasBorrowerProfitWriteAccess(loanId, session.user.id);
    if (!allowed) {
      return json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();
    const profitType = body.profitType === "fixed" ? "fixed" : "rate";
    const profitValue = Number.parseFloat(String(body.profitValue));

    if (!Number.isFinite(profitValue) || profitValue < 0) {
      return json(
        { error: "Enter a profit amount of zero or more." },
        { status: 400 },
      );
    }

    await db
      .update(loans)
      .set({
        profitType,
        profitValue: String(profitValue),
        updatedAt: new Date(),
      })
      .where(eq(loans.id, loanId));

    invalidateLoanData();
    return json({ success: true });
  } catch (error) {
    console.error("Error updating borrower profit:", error);
    return json({ error: "Failed to update profit." }, { status: 500 });
  }
};
