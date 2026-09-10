/**
 * Replace all received_payments linked to an interest period with a single row.
 * Used when multiple partial payments exist and the user edits the total in one step.
 */
import { json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { db } from "$lib/server/db";
import {
  interestPeriods,
  loanInvestors,
  receivedPayments,
} from "$lib/server/db/schema";
import { eq } from "drizzle-orm";
import { getSession } from "$lib/server/session";
import { invalidateLoanData } from "$lib/server/cache-invalidation";
import { calculateInterest } from "$lib/calculations";
import {
  recalculateInterestPeriodStatusFromLinkedPayments,
  syncLoanStatusFromInterestPeriods,
} from "$lib/server/loan-interest-period-sync";

const AMOUNT_TOLERANCE = 0.02;

export const POST: RequestHandler = async (event) => {
  const { params, request } = event;
  try {
    const session = await getSession(event);
    if (!session?.user?.id) {
      return json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = params;
    const periodId = parseInt(id, 10);
    if (!Number.isFinite(periodId)) {
      return json({ error: "Invalid period id" }, { status: 400 });
    }

    const body = await request.json();
    const rawAmt = body.amount;
    const receivedDateRaw = body.receivedDate;
    const parsedAmount =
      rawAmt === "" || rawAmt === null || rawAmt === undefined
        ? NaN
        : parseFloat(String(rawAmt));
    const dateStr =
      receivedDateRaw === null || receivedDateRaw === undefined
        ? ""
        : String(receivedDateRaw).trim();

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

    const period = await db.query.interestPeriods.findFirst({
      where: eq(interestPeriods.id, periodId),
      with: {
        loanInvestor: {
          with: {
            loan: true,
          },
        },
      },
    });

    if (!period) {
      return json({ error: "Interest period not found" }, { status: 404 });
    }

    if (period.loanInvestor.loan.userId !== session.user.id) {
      return json({ error: "Unauthorized" }, { status: 401 });
    }

    const coInvestors = await db.query.loanInvestors.findMany({
      where: eq(loanInvestors.loanId, period.loanInvestor.loanId),
    });
    const loanTotalPrincipal = coInvestors.reduce(
      (s, li) => s + (parseFloat(li.amount) || 0),
      0,
    );
    const investorPrincipal = parseFloat(period.loanInvestor.amount) || 0;
    const principalBase =
      investorPrincipal === 0 ? loanTotalPrincipal : investorPrincipal;
    const expectedInterest = calculateInterest(
      principalBase,
      period.interestRate,
      period.interestType,
    );

    if (parsedAmount > expectedInterest + AMOUNT_TOLERANCE) {
      return json(
        {
          error: `Amount cannot exceed the interest due for this period (${expectedInterest.toFixed(2)}).`,
        },
        { status: 400 },
      );
    }

    const loanId = period.loanInvestor.loanId;

    await db
      .delete(receivedPayments)
      .where(eq(receivedPayments.interestPeriodId, periodId));

    await db.insert(receivedPayments).values({
      loanInvestorId: period.loanInvestor.id,
      interestPeriodId: periodId,
      amount: String(parsedAmount),
      receivedDate: receivedDateObj,
    });

    await recalculateInterestPeriodStatusFromLinkedPayments(periodId);
    await syncLoanStatusFromInterestPeriods(loanId);

    invalidateLoanData();
    return json({ success: true });
  } catch (error) {
    console.error("Error consolidating period payments:", error);
    return json({ error: "Failed to update payments" }, { status: 500 });
  }
};
