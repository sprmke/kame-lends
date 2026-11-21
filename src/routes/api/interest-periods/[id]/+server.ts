import { json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import type { InterestPeriodStatus } from "$lib/types";
import { db } from "$lib/server/db";
import { interestPeriods, receivedPayments } from "$lib/server/db/schema";
import { eq, desc, isNull } from "drizzle-orm";
import { getSession } from "$lib/server/session";
import { invalidateLoanData } from "$lib/server/cache-invalidation";
import { centavosToPesos, toCentavos } from "$lib/money/centavos";
import { expectedInterestC, loadLoanLedger } from "$lib/server/loan-ledger";
import { parseIdParam } from "$lib/server/route-params";
import { recordMoneyAudit } from "$lib/server/money-audit";
import { periodPaymentSchema, firstSchemaError } from "$lib/schemas/payment";
import {
  hasPaymentReceipt,
  receiptColumnsFromInput,
  RECEIPT_REQUIRED_ERROR,
} from "$lib/payment-receipts";
import { syncLoanStatusFromInterestPeriods } from "$lib/server/loan-interest-period-sync";
import { toLocalDateString } from "$lib/date-utils";
import { parseOptionalPaymentNotes } from "$lib/payment-notes";

const AMOUNT_TOLERANCE_CENTAVOS = 0;

export const PATCH: RequestHandler = async (event) => {
  const { params, request } = event;
  try {
    const session = await getSession(event);
    const actorUserId = session?.user?.id;
    if (!actorUserId) {
      return json({ error: "Unauthorized" }, { status: 401 });
    }

    const periodId = parseIdParam(params.id);
    if (periodId === null) {
      return json({ error: "Invalid period id" }, { status: 400 });
    }
    const body = await request.json();
    const parsedBody = periodPaymentSchema.safeParse(body);
    if (!parsedBody.success) {
      return json(
        { error: firstSchemaError(parsedBody.error) },
        { status: 400 },
      );
    }

    const {
      status,
      receivedAmount,
      receivedDate,
      receipts,
      receiptImageUrl,
      receiptExtractedData,
    } = body;
    const notesParsed = parseOptionalPaymentNotes(body.notes);
    if ("error" in notesParsed) {
      return json({ error: notesParsed.error }, { status: 400 });
    }

    if (!status || !["Pending", "Completed", "Overdue"].includes(status)) {
      return json(
        {
          error:
            "Invalid status. Must be Pending, Completed (record payment), or Overdue.",
        },
        { status: 400 },
      );
    }

    const period = await db.query.interestPeriods.findFirst({
      where: eq(interestPeriods.id, periodId),
      with: {
        loanInvestor: {
          with: {
            loan: true,
            investor: true,
            receivedPayments: {
              where: isNull(receivedPayments.deletedAt),
              orderBy: [desc(receivedPayments.createdAt)],
            },
          },
        },
      },
    });

    if (!period) {
      return json({ error: "Interest period not found" }, { status: 404 });
    }

    if (period.loanInvestor.loan.userId !== actorUserId) {
      return json({ error: "Interest period not found" }, { status: 404 });
    }

    const wasCompleted = period.status === "Completed";
    const wasIncomplete = period.status === "Incomplete";
    const isReverting =
      (wasCompleted || wasIncomplete) &&
      (status === "Pending" || status === "Overdue");

    // Expected interest comes from the single engine, using the investor's
    // total capital for this loan (CALC-01).
    const loanIdForLedger = period.loanInvestor.loanId;
    const ledger = await loadLoanLedger(loanIdForLedger);
    const expectedInterestCents = ledger
      ? (expectedInterestC(ledger, periodId) ?? 0)
      : 0;
    const expectedInterest = centavosToPesos(expectedInterestCents);

    /** Response status may differ from request (e.g. Incomplete vs Completed). */
    let responseStatus: string = status;
    let pendingPeriodStatus: InterestPeriodStatus | null = null;
    let pendingPayment: typeof receivedPayments.$inferInsert | null = null;

    if (status === "Completed") {
      if (period.status === "Completed") {
        return json(
          { error: "This period is already completed." },
          { status: 400 },
        );
      }

      const rawAmt = receivedAmount;
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
          {
            error:
              "Enter a valid received amount greater than zero to record this payment.",
          },
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
      if (
        !hasPaymentReceipt({ receipts, receiptImageUrl, receiptExtractedData })
      ) {
        return json({ error: RECEIPT_REQUIRED_ERROR }, { status: 400 });
      }

      const linkedBefore = (period.loanInvestor.receivedPayments || []).filter(
        (rp) => rp.interestPeriodId === periodId,
      );
      const priorTotalCents = linkedBefore.reduce(
        (sum, rp) => sum + toCentavos(rp.amount),
        0,
      );
      const receivedCents = toCentavos(parsedAmount);

      if (
        priorTotalCents + AMOUNT_TOLERANCE_CENTAVOS >=
        expectedInterestCents
      ) {
        return json(
          { error: "This period is already fully paid." },
          { status: 400 },
        );
      }

      const newTotalCents = priorTotalCents + receivedCents;
      if (newTotalCents > expectedInterestCents + AMOUNT_TOLERANCE_CENTAVOS) {
        return json(
          {
            error: `This payment would exceed the interest due for this period (${expectedInterest.toFixed(2)}). Remaining: ${centavosToPesos(Math.max(expectedInterestCents - priorTotalCents, 0)).toFixed(2)}.`,
          },
          { status: 400 },
        );
      }

      const newPeriodStatus =
        newTotalCents + AMOUNT_TOLERANCE_CENTAVOS >= expectedInterestCents
          ? "Completed"
          : "Incomplete";

      pendingPeriodStatus = newPeriodStatus;
      pendingPayment = {
        loanInvestorId: period.loanInvestor.id,
        interestPeriodId: periodId,
        amount: String(parsedAmount),
        receivedDate: receivedDateObj,
        notes: notesParsed.notes,
        ...receiptColumnsFromInput({
          receipts,
          receiptImageUrl,
          receiptExtractedData,
        }),
      };
      responseStatus = newPeriodStatus;
    } else if (isReverting) {
      const linkedPayments = (
        period.loanInvestor.receivedPayments || []
      ).filter((rp) => rp.interestPeriodId === periodId);

      // Money is never deleted as a side effect of changing a status. If the
      // period is backed by payments, the status is a function of those rows;
      // the user must delete the payment itself (D-10).
      if (linkedPayments.length > 0) {
        return json(
          {
            error:
              "This period has recorded payments. Delete the payment instead of reverting the period.",
          },
          { status: 409 },
        );
      }

      pendingPeriodStatus = status;
    } else {
      pendingPeriodStatus = status;
    }

    const loanId = period.loanInvestor.loanId;

    // Status change, payment row, and audit event land together. A failed
    // insert must not leave a "Completed" period with no payment behind.
    await db.transaction(async (tx) => {
      if (pendingPeriodStatus) {
        await tx
          .update(interestPeriods)
          .set({ status: pendingPeriodStatus, updatedAt: new Date() })
          .where(eq(interestPeriods.id, periodId));
      }
      if (pendingPayment) {
        await tx.insert(receivedPayments).values(pendingPayment);
      }
      await recordMoneyAudit(tx, {
        actorUserId,
        entityType: "interest_period",
        entityId: periodId,
        loanId,
        action: status === "Completed" ? "payment" : "revert",
        before: { status: period.status },
        after: { status: responseStatus },
      });
    });

    await syncLoanStatusFromInterestPeriods(loanId);

    invalidateLoanData();
    if (pendingPayment) {
      try {
        const { enqueueGroupLoanChanged } =
          await import("$lib/server/jobs/queue");
        const { scheduleDrain } =
          await import("$lib/server/jobs/after-response");
        await enqueueGroupLoanChanged(loanId, {
          calendar: false,
          activity: {
            type: "interest_paid",
            entityId: periodId,
            actorUserId,
            actorEmail: session.user?.email ?? undefined,
            detail: {
              amount: Number.parseFloat(pendingPayment.amount ?? "0") || 0,
              date: pendingPayment.receivedDate
                ? toLocalDateString(pendingPayment.receivedDate)
                : "",
              investorName: period.loanInvestor.investor?.name ?? "",
            },
          },
        });
        scheduleDrain(event);
      } catch (notifyErr) {
        console.error("[email] interest payment notify failed", notifyErr);
      }
    }
    return json({ success: true, status: responseStatus });
  } catch (error) {
    console.error("Error updating interest period status:", error);
    return json(
      { error: "Failed to update interest period status" },
      { status: 500 },
    );
  }
};
