import { json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { and, eq } from "drizzle-orm";
import { getSession } from "$lib/server/session";
import { db } from "$lib/server/db";
import { loanInvestors } from "$lib/server/db/schema";
import { resolveInvestorCommissionWriteAccess } from "$lib/server/access-control";
import { invalidateLoanData } from "$lib/server/cache-invalidation";

export const PATCH: RequestHandler = async (event) => {
  const { params, request } = event;
  try {
    const session = await getSession(event);
    if (!session?.user?.id) {
      return json({ error: "Unauthorized" }, { status: 401 });
    }

    const loanId = Number.parseInt(params.id, 10);
    const loanInvestorId = Number.parseInt(params.loanInvestorId, 10);
    if (!Number.isFinite(loanId) || !Number.isFinite(loanInvestorId)) {
      return json({ error: "Invalid ID." }, { status: 400 });
    }

    const row = await db.query.loanInvestors.findFirst({
      where: and(
        eq(loanInvestors.id, loanInvestorId),
        eq(loanInvestors.loanId, loanId),
      ),
    });
    if (!row) {
      return json({ error: "Investor allocation not found." }, { status: 404 });
    }

    const allowed = await resolveInvestorCommissionWriteAccess(
      loanId,
      session.user.id,
      loanInvestorId,
    );
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

    await db
      .update(loanInvestors)
      .set({
        profitType,
        profitValue: String(profitValue),
        updatedAt: new Date(),
      })
      .where(eq(loanInvestors.id, loanInvestorId));

    invalidateLoanData();
    return json({ success: true });
  } catch (error) {
    console.error("Error updating investor commission:", error);
    return json({ error: "Failed to update commission." }, { status: 500 });
  }
};
