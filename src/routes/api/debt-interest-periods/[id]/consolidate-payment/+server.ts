import { json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { db } from "$lib/server/db";
import {
  debtInterestPeriods,
  debtReceivedPayments,
} from "$lib/server/db/schema";
import { eq } from "drizzle-orm";
import { getSession } from "$lib/server/session";
import { invalidateDebtData } from "$lib/server/cache-invalidation";
import { hasDebtAccess } from "$lib/server/access-control";
import {
  DEBT_AMOUNT_TOLERANCE,
  recalculateDebtInterestPeriodStatus,
} from "$lib/server/debt-interest-period-sync";

export const POST: RequestHandler = async (event) => {
  const { params, request } = event;
  try {
    const session = await getSession(event);
    if (!session?.user?.id) {
      return json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = params;
    const periodId = parseInt(id, 10);
    const { amount, receivedDate } = await request.json();

    const parsedAmount = parseFloat(String(amount ?? ""));
    const dateStr = String(receivedDate ?? "").trim();

    if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
      return json(
        { error: "Enter a valid received amount greater than zero." },
        { status: 400 },
      );
    }
    if (!dateStr) {
      return json({ error: "Received date is required." }, { status: 400 });
    }
    const receivedDateObj = new Date(dateStr);
    if (Number.isNaN(receivedDateObj.getTime())) {
      return json({ error: "Invalid received date." }, { status: 400 });
    }

    const period = await db.query.debtInterestPeriods.findFirst({
      where: eq(debtInterestPeriods.id, periodId),
      with: { debt: true },
    });

    if (!period) {
      return json({ error: "Interest period not found" }, { status: 404 });
    }

    const hasAccess = await hasDebtAccess(period.debtId, session.user.id);
    if (!hasAccess) {
      return json({ error: "Unauthorized" }, { status: 401 });
    }

    const expectedAmount = parseFloat(period.expectedInterest) || 0;
    if (parsedAmount > expectedAmount + DEBT_AMOUNT_TOLERANCE) {
      return json(
        {
          error: `Amount cannot exceed the payment due for this period (${expectedAmount.toFixed(2)}).`,
        },
        { status: 400 },
      );
    }

    await db
      .delete(debtReceivedPayments)
      .where(eq(debtReceivedPayments.debtInterestPeriodId, periodId));

    await db.insert(debtReceivedPayments).values({
      debtInterestPeriodId: periodId,
      amount: String(parsedAmount),
      receivedDate: receivedDateObj,
    });

    await recalculateDebtInterestPeriodStatus(periodId);

    invalidateDebtData();
    return json({ success: true });
  } catch (error) {
    console.error("Error consolidating debt payment:", error);
    return json({ error: "Failed to update payment" }, { status: 500 });
  }
};
