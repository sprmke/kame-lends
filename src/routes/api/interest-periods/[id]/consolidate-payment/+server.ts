/**
 * Replace all received_payments linked to an interest period with a single row.
 * Used when multiple partial payments exist and the user edits the total in one step.
 */
import { json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { db } from "$lib/server/db";
import { interestPeriods, receivedPayments } from "$lib/server/db/schema";
import { and, eq, inArray, isNull } from "drizzle-orm";
import { getSession } from "$lib/server/session";
import { invalidateLoanData } from "$lib/server/cache-invalidation";
import { centavosToPesos, toCentavos } from "$lib/money/centavos";
import { expectedInterestC, loadLoanLedger } from "$lib/server/loan-ledger";
import {
  recalculateInterestPeriodStatusFromLinkedPayments,
  syncLoanStatusFromInterestPeriods,
} from "$lib/server/loan-interest-period-sync";
import {
  hasPaymentReceipt,
  receiptColumnsFromInput,
  RECEIPT_REQUIRED_ERROR,
  uniqueReceipts,
} from "$lib/payment-receipts";
import { parseOptionalPaymentNotes } from "$lib/payment-notes";
import { parseIdParam } from "$lib/server/route-params";
import { recordMoneyAudit } from "$lib/server/money-audit";
import {
  consolidatePaymentSchema,
  firstSchemaError,
} from "$lib/schemas/payment";

const AMOUNT_TOLERANCE_CENTAVOS = 0;

export const POST: RequestHandler = async (event) => {
  const { params, request } = event;
  try {
    const session = await getSession(event);
    if (!session?.user?.id) {
      return json({ error: "Unauthorized" }, { status: 401 });
    }

    const actorUserId = session.user.id;
    const periodId = parseIdParam(params.id);
    if (periodId === null) {
      return json({ error: "Invalid period id" }, { status: 400 });
    }

    const body = await request.json();
    const parsedBody = consolidatePaymentSchema.safeParse(body);
    if (!parsedBody.success) {
      return json(
        { error: firstSchemaError(parsedBody.error) },
        { status: 400 },
      );
    }

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
    const notesParsed = parseOptionalPaymentNotes(body.notes);
    if ("error" in notesParsed) {
      return json({ error: notesParsed.error }, { status: 400 });
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

    if (period.loanInvestor.loan.userId !== actorUserId) {
      return json({ error: "Interest period not found" }, { status: 404 });
    }
    if (!hasPaymentReceipt(body)) {
      return json({ error: RECEIPT_REQUIRED_ERROR }, { status: 400 });
    }

    const ledger = await loadLoanLedger(period.loanInvestor.loanId);
    const expectedInterestCents = ledger
      ? (expectedInterestC(ledger, periodId) ?? 0)
      : 0;
    const expectedInterest = centavosToPesos(expectedInterestCents);

    if (
      toCentavos(parsedAmount) >
      expectedInterestCents + AMOUNT_TOLERANCE_CENTAVOS
    ) {
      return json(
        {
          error: `Amount cannot exceed the interest due for this period (${expectedInterest.toFixed(2)}).`,
        },
        { status: 400 },
      );
    }

    const loanId = period.loanInvestor.loanId;

    // One transaction: a failure after the delete must not leave the period
    // with no payment at all. Prior receipts are carried onto the merged row
    // so evidence is never dropped.
    //
    // Soft delete only (D-8): the first linked row is updated in place, so its
    // id and audit trail survive; extra rows are marked deleted instead of
    // being destroyed.
    await db.transaction(async (tx) => {
      const priorRows = await tx.query.receivedPayments.findMany({
        where: and(
          eq(receivedPayments.interestPeriodId, periodId),
          isNull(receivedPayments.deletedAt),
        ),
        orderBy: (table, { asc }) => [asc(table.id)],
      });

      const mergedReceipts = uniqueReceipts([
        ...priorRows.flatMap((row) => row.receipts ?? []),
        ...receiptColumnsFromInput(body).receipts,
      ]);
      const priorNotes =
        priorRows
          .map((row) => row.notes?.trim())
          .filter((note): note is string => Boolean(note))
          .join("\n") || null;

      const mergedValues = {
        loanInvestorId: period.loanInvestor.id,
        interestPeriodId: periodId,
        amount: String(parsedAmount),
        receivedDate: receivedDateObj,
        notes: notesParsed.notes ?? priorNotes,
        ...receiptColumnsFromInput({
          ...body,
          receipts: mergedReceipts,
        }),
        updatedAt: new Date(),
      };

      const keep = priorRows[0];
      if (keep) {
        await tx
          .update(receivedPayments)
          .set(mergedValues)
          .where(eq(receivedPayments.id, keep.id));
        const extraIds = priorRows.slice(1).map((row) => row.id);
        if (extraIds.length > 0) {
          await tx
            .update(receivedPayments)
            .set({ deletedAt: new Date(), updatedAt: new Date() })
            .where(inArray(receivedPayments.id, extraIds));
        }
      } else {
        await tx.insert(receivedPayments).values(mergedValues);
      }

      await recordMoneyAudit(tx, {
        actorUserId,
        entityType: "interest_period",
        entityId: periodId,
        loanId,
        action: "consolidate",
        before: {
          amount: expectedInterest,
          linkedPayments: priorRows.map((row) => row.amount),
        },
        after: { amount: parsedAmount, keptPaymentId: keep?.id ?? null },
      });
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
