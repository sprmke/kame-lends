import { json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { and, eq } from "drizzle-orm";
import { getSession } from "$lib/server/session";
import { db } from "$lib/server/db";
import { loanInvestors, receivedPayments } from "$lib/server/db/schema";
import { hasLoanAdminAccess } from "$lib/server/access-control";
import { calculateInterest, calculateTotalAmount } from "$lib/calculations";
import { invalidateLoanData } from "$lib/server/cache-invalidation";
import {
  recalculateInterestPeriodStatusFromLinkedPayments,
  syncLoanStatusFromInterestPeriods,
} from "$lib/server/loan-interest-period-sync";
import { normalizeReceiptImageUrl } from "$lib/receipt-image";

const AMOUNT_TOLERANCE = 0.02;

export const POST: RequestHandler = async (event) => {
  const { params, request } = event;
  try {
    const session = await getSession(event);
    if (!session?.user?.id) {
      return json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = params;
    const loanId = Number.parseInt(id, 10);
    if (!Number.isFinite(loanId)) {
      return json({ error: "Invalid loan ID." }, { status: 400 });
    }
    const allowed = await hasLoanAdminAccess(loanId, session.user.id);
    if (!allowed) {
      return json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();
    const investorId = Number.parseInt(String(body.investorId), 10);
    const amount = Number.parseFloat(String(body.amount));
    const receivedDate = new Date(String(body.receivedDate ?? ""));
    const requestedPeriodId =
      body.interestPeriodId === null ||
      body.interestPeriodId === undefined ||
      body.interestPeriodId === ""
        ? null
        : Number.parseInt(String(body.interestPeriodId), 10);

    if (!Number.isFinite(investorId)) {
      return json(
        { error: "Select the lender receiving this payment." },
        { status: 400 },
      );
    }
    if (!Number.isFinite(amount) || amount <= 0) {
      return json(
        { error: "Enter an amount greater than zero." },
        { status: 400 },
      );
    }
    if (Number.isNaN(receivedDate.getTime())) {
      return json(
        { error: "A valid received date is required." },
        { status: 400 },
      );
    }
    if (requestedPeriodId !== null && !Number.isFinite(requestedPeriodId)) {
      return json({ error: "Invalid interest period." }, { status: 400 });
    }

    const lenderPayments = await db.query.loanInvestors.findMany({
      where: and(
        eq(loanInvestors.loanId, loanId),
        eq(loanInvestors.investorId, investorId),
      ),
      with: {
        interestPeriods: true,
        receivedPayments: true,
      },
    });
    if (!lenderPayments.length) {
      return json(
        { error: "The selected lender is not assigned to this loan." },
        { status: 400 },
      );
    }

    const totalDue = calculateTotalAmount(lenderPayments);
    const totalReceived = lenderPayments
      .flatMap((payment) => payment.receivedPayments)
      .reduce(
        (sum, payment) => sum + (Number.parseFloat(payment.amount) || 0),
        0,
      );
    if (totalReceived + amount > totalDue + AMOUNT_TOLERANCE) {
      return json(
        {
          error: `This exceeds the lender's remaining balance (${Math.max(0, totalDue - totalReceived).toFixed(2)}).`,
        },
        { status: 400 },
      );
    }

    let targetLoanInvestorId = lenderPayments[0].id;
    if (requestedPeriodId !== null) {
      const period = lenderPayments
        .flatMap((payment) => payment.interestPeriods)
        .find((item) => item.id === requestedPeriodId);
      if (!period) {
        return json(
          {
            error: "The selected interest period does not belong to this loan.",
          },
          { status: 400 },
        );
      }

      targetLoanInvestorId = period.loanInvestorId;
      const linkedPayments = await db.query.receivedPayments.findMany({
        where: eq(receivedPayments.interestPeriodId, period.id),
      });
      const paidForPeriod = linkedPayments.reduce(
        (sum, payment) => sum + (Number.parseFloat(payment.amount) || 0),
        0,
      );
      const lenderPrincipal = lenderPayments.reduce(
        (sum, payment) => sum + (Number.parseFloat(payment.amount) || 0),
        0,
      );
      const periodDue = calculateInterest(
        lenderPrincipal,
        period.interestRate,
        period.interestType,
      );

      if (paidForPeriod + amount > periodDue + AMOUNT_TOLERANCE) {
        return json(
          {
            error: `This exceeds the remaining interest for that period (${Math.max(0, periodDue - paidForPeriod).toFixed(2)}).`,
          },
          { status: 400 },
        );
      }
    }

    await db.insert(receivedPayments).values({
      loanInvestorId: targetLoanInvestorId,
      interestPeriodId: requestedPeriodId,
      amount: String(amount),
      receivedDate,
      receiptImageUrl: normalizeReceiptImageUrl(body.receiptImageUrl),
      receiptExtractedData: body.receiptExtractedData ?? null,
    });

    if (requestedPeriodId !== null) {
      await recalculateInterestPeriodStatusFromLinkedPayments(
        requestedPeriodId,
      );
      await syncLoanStatusFromInterestPeriods(loanId);
    }

    invalidateLoanData();
    return json({ success: true }, { status: 201 });
  } catch (error) {
    console.error("Error adding received payment:", error);
    return json({ error: "Failed to add received payment." }, { status: 500 });
  }
};
