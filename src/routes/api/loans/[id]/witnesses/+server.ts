import { json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { and, eq } from "drizzle-orm";
import { getSession } from "$lib/server/session";
import { db } from "$lib/server/db";
import { loanWitnesses } from "$lib/server/db/schema";
import { hasLoanAdminAccess, isOwnedWitness } from "$lib/server/access-control";
import { invalidateLoanData } from "$lib/server/cache-invalidation";

export const POST: RequestHandler = async (event) => {
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

    const allowed = await hasLoanAdminAccess(loanId, session.user.id);
    if (!allowed) {
      return json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();
    const witnessId = Number.parseInt(String(body.witnessId), 10);
    if (!Number.isFinite(witnessId)) {
      return json({ error: "Select a witness." }, { status: 400 });
    }

    const profitType = body.profitType === "fixed" ? "fixed" : "rate";
    const profitValue = Number.isFinite(
      Number.parseFloat(String(body.profitValue)),
    )
      ? Number.parseFloat(String(body.profitValue))
      : 0;
    if (profitValue < 0) {
      return json(
        { error: "Enter a profit amount of zero or more." },
        { status: 400 },
      );
    }

    if (!(await isOwnedWitness(witnessId, session.user.id))) {
      return json({ error: "Witness not found." }, { status: 404 });
    }

    const existing = await db.query.loanWitnesses.findFirst({
      where: and(
        eq(loanWitnesses.loanId, loanId),
        eq(loanWitnesses.witnessId, witnessId),
      ),
    });
    if (existing) {
      return json(
        { error: "This witness is already assigned to this loan." },
        { status: 409 },
      );
    }

    const [inserted] = await db
      .insert(loanWitnesses)
      .values({
        loanId,
        witnessId,
        profitType,
        profitValue: String(profitValue),
      })
      .returning();

    invalidateLoanData();
    return json({ success: true, loanWitness: inserted }, { status: 201 });
  } catch (error) {
    console.error("Error adding loan witness:", error);
    return json({ error: "Failed to add witness." }, { status: 500 });
  }
};
