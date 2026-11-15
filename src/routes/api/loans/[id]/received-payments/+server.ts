import { json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { and, eq, isNull } from "drizzle-orm";
import { parseIdParam } from "$lib/server/route-params";
import { idempotencyKeys } from "$lib/server/db/schema";
import {
  receivedPaymentCreateSchema,
  firstSchemaError,
} from "$lib/schemas/payment";
import { getSession } from "$lib/server/session";
import { db } from "$lib/server/db";
import {
  loanInvestors,
  receivedPayments,
  investors,
} from "$lib/server/db/schema";
import { assertLoanAdmin } from "$lib/server/route-auth";
import { calculateTotalAmount } from "$lib/calculations";
import { centavosToPesos, toCentavos } from "$lib/money/centavos";
import { expectedInterestC, loadLoanLedger } from "$lib/server/loan-ledger";
import {
  claimIdempotencyKey,
  findIdempotentResponse,
  idempotencyKeyOf,
  rememberIdempotentResponse,
} from "$lib/server/idempotency";
import { invalidateLoanData } from "$lib/server/cache-invalidation";
import { toLocalDateString } from "$lib/date-utils";
import {
  recalculateInterestPeriodStatusFromLinkedPayments,
  syncLoanStatusFromInterestPeriods,
} from "$lib/server/loan-interest-period-sync";
import {
  hasPaymentReceipt,
  receiptColumnsFromInput,
  RECEIPT_REQUIRED_ERROR,
} from "$lib/payment-receipts";
import { parseOptionalPaymentNotes } from "$lib/payment-notes";

async function investorName(investorId: number): Promise<string> {
  const row = await db.query.investors.findFirst({
    where: eq(investors.id, investorId),
    columns: { name: true },
  });
  return row?.name?.trim() ?? "";
}

const AMOUNT_TOLERANCE_CENTAVOS = 0;

export const POST: RequestHandler = async (event) => {
  const { params, request } = event;
  try {
    const session = await getSession(event);
    if (!session?.user?.id) {
      return json({ error: "Unauthorized" }, { status: 401 });
    }

    const loanId = parseIdParam(params.id);
    if (loanId === null) {
      return json({ error: "Invalid loan ID." }, { status: 400 });
    }
    const idempotencyKey = idempotencyKeyOf(request);
    const idempotencyRoute = `POST /api/loans/${loanId}/received-payments`;
    if (idempotencyKey) {
      const replay = await findIdempotentResponse(
        idempotencyKey,
        session.user.id,
        idempotencyRoute,
      );
      if (replay) {
        return json(replay.body as Record<string, unknown>, {
          status: replay.status,
        });
      }
    }
    const authError = await assertLoanAdmin(loanId, session.user.id);
    if (authError) return authError;

    const body = await request.json();
    const parsedBody = receivedPaymentCreateSchema.safeParse(body);
    if (!parsedBody.success) {
      return json(
        { error: firstSchemaError(parsedBody.error) },
        { status: 400 },
      );
    }

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
    if (!hasPaymentReceipt(body)) {
      return json({ error: RECEIPT_REQUIRED_ERROR }, { status: 400 });
    }
    const notesParsed = parseOptionalPaymentNotes(body.notes);
    if ("error" in notesParsed) {
      return json({ error: notesParsed.error }, { status: 400 });
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
    if (
      toCentavos(totalReceived) + toCentavos(amount) >
      toCentavos(totalDue) + AMOUNT_TOLERANCE_CENTAVOS
    ) {
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
        where: and(
          eq(receivedPayments.interestPeriodId, period.id),
          isNull(receivedPayments.deletedAt),
        ),
      });
      const paidForPeriod = linkedPayments.reduce(
        (sum, payment) => sum + (Number.parseFloat(payment.amount) || 0),
        0,
      );
      const ledger = await loadLoanLedger(loanId);
      const periodDue = ledger
        ? centavosToPesos(expectedInterestC(ledger, period.id) ?? 0)
        : 0;

      if (
        toCentavos(paidForPeriod) + toCentavos(amount) >
        toCentavos(periodDue) + AMOUNT_TOLERANCE_CENTAVOS
      ) {
        return json(
          {
            error: `This exceeds the remaining interest for that period (${Math.max(0, periodDue - paidForPeriod).toFixed(2)}).`,
          },
          { status: 400 },
        );
      }
    }

    if (idempotencyKey) {
      const claimed = await claimIdempotencyKey(
        idempotencyKey,
        session.user.id,
        idempotencyRoute,
      );
      if (!claimed) {
        const replay = await findIdempotentResponse(
          idempotencyKey,
          session.user.id,
          idempotencyRoute,
        );
        return replay
          ? json(replay.body as Record<string, unknown>, {
              status: replay.status,
            })
          : json(
              { error: "This request is already in progress." },
              { status: 409 },
            );
      }
    }

    await db.insert(receivedPayments).values({
      loanInvestorId: targetLoanInvestorId,
      interestPeriodId: requestedPeriodId,
      amount: String(amount),
      receivedDate,
      notes: notesParsed.notes,
      ...receiptColumnsFromInput(body),
    });

    if (requestedPeriodId !== null) {
      await recalculateInterestPeriodStatusFromLinkedPayments(
        requestedPeriodId,
      );
    }
    await syncLoanStatusFromInterestPeriods(loanId);

    if (idempotencyKey) {
      await rememberIdempotentResponse(
        idempotencyKey,
        session.user.id,
        idempotencyRoute,
        201,
        { success: true },
      );
    }

    invalidateLoanData();
    try {
      const { enqueueGroupLoanChanged } =
        await import("$lib/server/jobs/queue");
      const { scheduleDrain } = await import("$lib/server/jobs/after-response");
      await enqueueGroupLoanChanged(loanId, {
        activity: {
          type: "payment_received",
          entityId: loanId,
          detail: {
            amount,
            date: toLocalDateString(receivedDate),
            investorName: await investorName(investorId),
          },
        },
      });
      scheduleDrain(event);
    } catch (groupErr) {
      console.error("[groups] post-received-payment sync failed", groupErr);
    }
    return json({ success: true }, { status: 201 });
  } catch (error) {
    console.error("Error adding received payment:", error);
    try {
      const key = idempotencyKeyOf(event.request);
      if (key) {
        await db.delete(idempotencyKeys).where(eq(idempotencyKeys.key, key));
      }
    } catch {
      /* cleanup is best-effort */
    }
    return json({ error: "Failed to add received payment." }, { status: 500 });
  }
};
