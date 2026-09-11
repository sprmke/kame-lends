import { json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { and, eq } from "drizzle-orm";
import { getSession } from "$lib/server/session";
import { db } from "$lib/server/db";
import { loanWitnesses } from "$lib/server/db/schema";
import {
  getLoanAccessContext,
  isOwnedWitness,
  resolveWitnessProfitWriteAccess,
} from "$lib/server/access-control";
import { invalidateLoanData } from "$lib/server/cache-invalidation";

export const PATCH: RequestHandler = async (event) => {
  const { params, request } = event;
  try {
    const session = await getSession(event);
    if (!session?.user?.id) {
      return json({ error: "Unauthorized" }, { status: 401 });
    }

    const loanId = Number.parseInt(params.id, 10);
    const witnessLoanId = Number.parseInt(params.witnessLoanId, 10);
    if (!Number.isFinite(loanId) || !Number.isFinite(witnessLoanId)) {
      return json({ error: "Invalid ID." }, { status: 400 });
    }

    const row = await db.query.loanWitnesses.findFirst({
      where: and(
        eq(loanWitnesses.id, witnessLoanId),
        eq(loanWitnesses.loanId, loanId),
      ),
    });
    if (!row) {
      return json({ error: "Witness assignment not found." }, { status: 404 });
    }

    const access = await getLoanAccessContext(loanId, session.user.id);
    const allowed = await resolveWitnessProfitWriteAccess(
      loanId,
      session.user.id,
      witnessLoanId,
    );
    if (!allowed) {
      return json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();
    const updates: Partial<typeof loanWitnesses.$inferInsert> = {
      updatedAt: new Date(),
    };

    if (body.profitType !== undefined) {
      updates.profitType = body.profitType === "fixed" ? "fixed" : "rate";
    }
    if (body.profitValue !== undefined) {
      const profitValue = Number.parseFloat(String(body.profitValue));
      if (!Number.isFinite(profitValue) || profitValue < 0) {
        return json(
          { error: "Enter a profit amount of zero or more." },
          { status: 400 },
        );
      }
      updates.profitValue = String(profitValue);
    }

    // Only the owner may reassign which witness this row belongs to.
    if (body.witnessId !== undefined) {
      if (!access.canAdminEdit) {
        return json({ error: "Forbidden" }, { status: 403 });
      }
      const witnessId = Number.parseInt(String(body.witnessId), 10);
      if (!Number.isFinite(witnessId)) {
        return json({ error: "Select a witness." }, { status: 400 });
      }
      if (!(await isOwnedWitness(witnessId, session.user.id))) {
        return json({ error: "Witness not found." }, { status: 404 });
      }
      updates.witnessId = witnessId;
    }

    const [updated] = await db
      .update(loanWitnesses)
      .set(updates)
      .where(eq(loanWitnesses.id, witnessLoanId))
      .returning();

    invalidateLoanData();
    return json({ success: true, loanWitness: updated });
  } catch (error) {
    console.error("Error updating loan witness:", error);
    return json({ error: "Failed to update witness." }, { status: 500 });
  }
};

export const DELETE: RequestHandler = async (event) => {
  const { params } = event;
  try {
    const session = await getSession(event);
    if (!session?.user?.id) {
      return json({ error: "Unauthorized" }, { status: 401 });
    }

    const loanId = Number.parseInt(params.id, 10);
    const witnessLoanId = Number.parseInt(params.witnessLoanId, 10);
    if (!Number.isFinite(loanId) || !Number.isFinite(witnessLoanId)) {
      return json({ error: "Invalid ID." }, { status: 400 });
    }

    const access = await getLoanAccessContext(loanId, session.user.id);
    if (!access.canAdminEdit) {
      return json({ error: "Forbidden" }, { status: 403 });
    }

    await db
      .delete(loanWitnesses)
      .where(
        and(
          eq(loanWitnesses.id, witnessLoanId),
          eq(loanWitnesses.loanId, loanId),
        ),
      );

    invalidateLoanData();
    return json({ success: true });
  } catch (error) {
    console.error("Error removing loan witness:", error);
    return json({ error: "Failed to remove witness." }, { status: 500 });
  }
};
