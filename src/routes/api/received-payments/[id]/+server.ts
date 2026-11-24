import { json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { db } from "$lib/server/db";
import {
  receivedPayments,
  interestPeriods,
  loanInvestors,
} from "$lib/server/db/schema";
import { eq, and, ne, isNull } from "drizzle-orm";
import { getSession } from "$lib/server/session";
import { toLocalDateString } from "$lib/date-utils";
import { invalidateLoanData } from "$lib/server/cache-invalidation";
import { centavosToPesos, toCentavos } from "$lib/money/centavos";
import { expectedInterestC, loadLoanLedger } from "$lib/server/loan-ledger";
import { parseIdParam } from "$lib/server/route-params";
import { recordMoneyAudit } from "$lib/server/money-audit";
import {
  receivedPaymentPatchSchema,
  firstSchemaError,
} from "$lib/schemas/payment";
import { parseOptionalPaymentNotes } from "$lib/payment-notes";
import { receiptColumnsFromInput } from "$lib/payment-receipts";
import {
  recalculateInterestPeriodStatusFromLinkedPayments,
  syncLoanStatusFromInterestPeriods,
} from "$lib/server/loan-interest-period-sync";

const AMOUNT_TOLERANCE_CENTAVOS = 0;

export const PATCH: RequestHandler = async (event) => {
  const { params, request } = event;
  try {
    const session = await getSession(event);
    if (!session?.user?.id) {
      return json({ error: "Unauthorized" }, { status: 401 });
    }

    const paymentId = parseIdParam(params.id);
    if (paymentId === null) {
      return json({ error: "Invalid id" }, { status: 400 });
    }

    const body = await request.json();
    const parsedBody = receivedPaymentPatchSchema.safeParse(body);
    if (!parsedBody.success) {
      return json(
        { error: firstSchemaError(parsedBody.error) },
        { status: 400 },
      );
    }

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
    let notesPatch: { notes: string | null } | undefined;
    if (Object.prototype.hasOwnProperty.call(body, "notes")) {
      const notesParsed = parseOptionalPaymentNotes(body.notes);
      if ("error" in notesParsed) {
        return json({ error: notesParsed.error }, { status: 400 });
      }
      notesPatch = { notes: notesParsed.notes };
    }

    const rp = await db.query.receivedPayments.findFirst({
      where: eq(receivedPayments.id, paymentId),
      with: {
        loanInvestor: {
          with: {
            loan: true,
            investor: true,
          },
        },
      },
    });

    if (!rp) {
      return json({ error: "Received payment not found" }, { status: 404 });
    }

    if (rp.loanInvestor.loan.userId !== session.user.id) {
      return json({ error: "Received payment not found" }, { status: 404 });
    }

    const periodId = rp.interestPeriodId;
    const loanId = rp.loanInvestor.loanId;

    if (periodId != null) {
      const others = await db.query.receivedPayments.findMany({
        where: and(
          eq(receivedPayments.interestPeriodId, periodId),
          ne(receivedPayments.id, paymentId),
          isNull(receivedPayments.deletedAt),
        ),
      });
      const otherSumCents = others.reduce(
        (sum, row) => sum + toCentavos(row.amount),
        0,
      );
      const newTotalCents = otherSumCents + toCentavos(parsedAmount);

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

      const ledger = await loadLoanLedger(period.loanInvestor.loanId);
      const expectedInterestCents = ledger
        ? (expectedInterestC(ledger, periodId) ?? 0)
        : 0;
      const expectedInterest = centavosToPesos(expectedInterestCents);

      if (newTotalCents > expectedInterestCents + AMOUNT_TOLERANCE_CENTAVOS) {
        return json(
          {
            error: `Amount would exceed the interest due for this period (${expectedInterest.toFixed(2)}). Maximum for this line: ${centavosToPesos(Math.max(expectedInterestCents - otherSumCents, 0)).toFixed(2)}.`,
          },
          { status: 400 },
        );
      }
    }

    const actorUserId = session.user.id;
    const receiptPatch = [
      "receipts",
      "receiptImageUrl",
      "receiptExtractedData",
    ].some((key) => Object.prototype.hasOwnProperty.call(body, key))
      ? receiptColumnsFromInput(body)
      : {};
    await db.transaction(async (tx) => {
      await tx
        .update(receivedPayments)
        .set({
          amount: String(parsedAmount),
          receivedDate: receivedDateObj,
          updatedAt: new Date(),
          ...notesPatch,
          ...receiptPatch,
        })
        .where(eq(receivedPayments.id, paymentId));

      await recordMoneyAudit(tx, {
        actorUserId,
        entityType: "received_payment",
        entityId: paymentId,
        loanId,
        action: "update",
        before: { amount: rp.amount, receivedDate: rp.receivedDate },
        after: { amount: parsedAmount, receivedDate: receivedDateObj },
      });
    });

    if (periodId != null) {
      await recalculateInterestPeriodStatusFromLinkedPayments(periodId);
    }

    await syncLoanStatusFromInterestPeriods(loanId);

    invalidateLoanData();
    try {
      const { enqueueGroupLoanChanged } =
        await import("$lib/server/jobs/queue");
      const { scheduleDrain } = await import("$lib/server/jobs/after-response");
      await enqueueGroupLoanChanged(loanId, {
        calendar: false,
        activity: {
          type: "payment_received",
          entityId: paymentId,
          actorUserId: session.user.id,
          actorEmail: session.user?.email ?? undefined,
          detail: {
            amount: parsedAmount,
            date: toLocalDateString(receivedDateObj),
            investorName: rp.loanInvestor.investor?.name ?? "",
          },
        },
      });
      scheduleDrain(event);
    } catch (notifyErr) {
      console.error("[email] payment update notify failed", notifyErr);
    }
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

    const paymentId = parseIdParam(params.id);
    if (paymentId === null) {
      return json({ error: "Invalid id" }, { status: 400 });
    }

    const rp = await db.query.receivedPayments.findFirst({
      where: eq(receivedPayments.id, paymentId),
      with: {
        loanInvestor: {
          with: {
            loan: true,
            investor: true,
          },
        },
      },
    });

    if (!rp) {
      return json({ error: "Received payment not found" }, { status: 404 });
    }

    if (rp.loanInvestor.loan.userId !== session.user.id) {
      return json({ error: "Received payment not found" }, { status: 404 });
    }

    const periodId = rp.interestPeriodId;
    const loanId = rp.loanInvestor.loanId;

    const actorUserId = session.user.id;
    await db.transaction(async (tx) => {
      await tx
        .update(receivedPayments)
        .set({ deletedAt: new Date(), updatedAt: new Date() })
        .where(eq(receivedPayments.id, paymentId));

      await recordMoneyAudit(tx, {
        actorUserId,
        entityType: "received_payment",
        entityId: paymentId,
        loanId,
        action: "delete",
        before: { amount: rp.amount, receivedDate: rp.receivedDate },
        reason: "payment deleted",
      });
    });

    if (periodId != null) {
      await recalculateInterestPeriodStatusFromLinkedPayments(periodId);
    }

    await syncLoanStatusFromInterestPeriods(loanId);

    invalidateLoanData();
    try {
      const { enqueueGroupLoanChanged } =
        await import("$lib/server/jobs/queue");
      const { scheduleDrain } = await import("$lib/server/jobs/after-response");
      const removedAmount = Number.parseFloat(rp.amount);
      await enqueueGroupLoanChanged(loanId, {
        calendar: false,
        activity: {
          type: "payment_removed",
          entityId: paymentId,
          actorUserId: session.user.id,
          actorEmail: session.user?.email ?? undefined,
          detail: {
            amount: Number.isFinite(removedAmount) ? removedAmount : undefined,
            date: toLocalDateString(rp.receivedDate),
            investorName: rp.loanInvestor.investor?.name ?? "",
          },
        },
      });
      scheduleDrain(event);
    } catch (notifyErr) {
      console.error("[email] payment delete notify failed", notifyErr);
    }
    return json({ success: true });
  } catch (error) {
    console.error("Error deleting received payment:", error);
    return json(
      { error: "Failed to delete received payment" },
      { status: 500 },
    );
  }
};
