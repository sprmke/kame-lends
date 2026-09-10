import { json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { db } from "$lib/server/db";
import {
  receivedPayments,
  interestPeriods,
  loanInvestors,
} from "$lib/server/db/schema";
import { eq, and, ne } from "drizzle-orm";
import { getSession } from "$lib/server/session";
import { invalidateLoanData } from "$lib/server/cache-invalidation";
import { calculateInterest } from "$lib/calculations";
import {
  recalculateInterestPeriodStatusFromLinkedPayments,
  syncLoanStatusFromInterestPeriods,
} from "$lib/server/loan-interest-period-sync";

const AMOUNT_TOLERANCE = 0.02;

export const PATCH: RequestHandler = async (event) => {
  const { params, request } = event;
  try {
    const session = await getSession(event);
    if (!session?.user?.id) {
      return json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = params;
    const paymentId = parseInt(id, 10);
    if (!Number.isFinite(paymentId)) {
      return json({ error: "Invalid id" }, { status: 400 });
    }

    const body = await request.json();
    const rawAmt = body.amount;
    const receivedDate = body.receivedDate;
    const parsedAmount =
      rawAmt === "" || rawAmt === null || rawAmt === undefined
        ? NaN
        : parseFloat(String(rawAmt));
    const dateStr =
      receivedDate === null || receivedDate === undefined
        ? ""
        : String(receivedDate).trim();

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

    const rp = await db.query.receivedPayments.findFirst({
      where: eq(receivedPayments.id, paymentId),
      with: {
        loanInvestor: {
          with: {
            loan: true,
          },
        },
      },
    });

    if (!rp) {
      return json({ error: "Received payment not found" }, { status: 404 });
    }

    if (rp.loanInvestor.loan.userId !== session.user.id) {
      return json({ error: "Unauthorized" }, { status: 401 });
    }

    const periodId = rp.interestPeriodId;
    const loanId = rp.loanInvestor.loanId;

    if (periodId != null) {
      const others = await db.query.receivedPayments.findMany({
        where: and(
          eq(receivedPayments.interestPeriodId, periodId),
          ne(receivedPayments.id, paymentId),
        ),
      });
      const otherSum = others.reduce(
        (s, row) => s + (parseFloat(row.amount) || 0),
        0,
      );
      const newTotal = otherSum + parsedAmount;

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
        return json({ error: "Interest period not found" }, { status: 400 });
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

      if (newTotal > expectedInterest + AMOUNT_TOLERANCE) {
        return json(
          {
            error: `Amount would exceed the interest due for this period (${expectedInterest.toFixed(2)}). Maximum for this line: ${(expectedInterest - otherSum).toFixed(2)}.`,
          },
          { status: 400 },
        );
      }
    }

    await db
      .update(receivedPayments)
      .set({
        amount: String(parsedAmount),
        receivedDate: receivedDateObj,
        updatedAt: new Date(),
      })
      .where(eq(receivedPayments.id, paymentId));

    if (periodId != null) {
      await recalculateInterestPeriodStatusFromLinkedPayments(periodId);
    }

    await syncLoanStatusFromInterestPeriods(loanId);

    invalidateLoanData();
    return json({ success: true });
  } catch (error) {
    console.error("Error updating received payment:", error);
    return json(
      { error: "Failed to update received payment" },
      { status: 500 },
    );
  }
};

export const DELETE: RequestHandler = async (event) => {
  const { params, request } = event;
  try {
    const session = await getSession(event);
    if (!session?.user?.id) {
      return json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = params;
    const paymentId = parseInt(id, 10);
    if (!Number.isFinite(paymentId)) {
      return json({ error: "Invalid id" }, { status: 400 });
    }

    const rp = await db.query.receivedPayments.findFirst({
      where: eq(receivedPayments.id, paymentId),
      with: {
        loanInvestor: {
          with: {
            loan: true,
          },
        },
      },
    });

    if (!rp) {
      return json({ error: "Received payment not found" }, { status: 404 });
    }

    if (rp.loanInvestor.loan.userId !== session.user.id) {
      return json({ error: "Unauthorized" }, { status: 401 });
    }

    const periodId = rp.interestPeriodId;
    const loanId = rp.loanInvestor.loanId;

    await db.delete(receivedPayments).where(eq(receivedPayments.id, paymentId));

    if (periodId != null) {
      await recalculateInterestPeriodStatusFromLinkedPayments(periodId);
    }

    await syncLoanStatusFromInterestPeriods(loanId);

    invalidateLoanData();
    return json({ success: true });
  } catch (error) {
    console.error("Error deleting received payment:", error);
    return json(
      { error: "Failed to delete received payment" },
      { status: 500 },
    );
  }
};
