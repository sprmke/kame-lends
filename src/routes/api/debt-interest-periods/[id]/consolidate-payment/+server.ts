import { json } from "@sveltejs/kit";
import { parseIdParam } from "$lib/server/route-params";
import type { RequestHandler } from "./$types";
import { db } from "$lib/server/db";
import {
  debtInterestPeriods,
  debtReceivedPayments,
} from "$lib/server/db/schema";
import { and, eq, inArray, isNull } from "drizzle-orm";
import { getSession } from "$lib/server/session";
import { invalidateDebtData } from "$lib/server/cache-invalidation";
import { hasDebtAdminAccess } from "$lib/server/access-control";
import { debtPaymentSchema, firstDebtError } from "$lib/schemas/debt";
import { recordMoneyAudit } from "$lib/server/money-audit";
import {
  DEBT_AMOUNT_TOLERANCE,
  recalculateDebtInterestPeriodStatus,
} from "$lib/server/debt-interest-period-sync";

export const POST: RequestHandler = async (event) => {
  const { params, request } = event;
  try {
    const session = await getSession(event);
    const actorUserId = session?.user?.id;
    if (!actorUserId) {
      return json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = params;
    const periodId = parseIdParam(id);
    if (periodId === null) {
      return json({ error: "Invalid id" }, { status: 400 });
    }
    const body = await request.json();
    const parsedBody = debtPaymentSchema.safeParse(body);
    if (!parsedBody.success) {
      return json({ error: firstDebtError(parsedBody.error) }, { status: 400 });
    }
    const { amount, receivedDate } = body;

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

    const hasAccess = await hasDebtAdminAccess(period.debtId, actorUserId);
    if (!hasAccess) {
      return json({ error: "Interest period not found" }, { status: 404 });
    }

    const expectedAmount = parseFloat(period.expectedInstallment) || 0;
    if (parsedAmount > expectedAmount + DEBT_AMOUNT_TOLERANCE) {
      return json(
        {
          error: `Amount cannot exceed the payment due for this period (${expectedAmount.toFixed(2)}).`,
        },
        { status: 400 },
      );
    }

    // Update in place and soft-delete extras (D-8). Deleting and re-inserting
    // lost the payment id and any history attached to it.
    await db.transaction(async (tx) => {
      const priorRows = await tx.query.debtReceivedPayments.findMany({
        where: and(
          eq(debtReceivedPayments.debtInterestPeriodId, periodId),
          isNull(debtReceivedPayments.deletedAt),
        ),
        orderBy: (table, { asc }) => [asc(table.id)],
      });

      const keep = priorRows[0];
      if (keep) {
        await tx
          .update(debtReceivedPayments)
          .set({
            amount: String(parsedAmount),
            receivedDate: receivedDateObj,
            updatedAt: new Date(),
          })
          .where(eq(debtReceivedPayments.id, keep.id));
        const extraIds = priorRows.slice(1).map((row) => row.id);
        if (extraIds.length > 0) {
          await tx
            .update(debtReceivedPayments)
            .set({ deletedAt: new Date(), updatedAt: new Date() })
            .where(inArray(debtReceivedPayments.id, extraIds));
        }
      } else {
        await tx.insert(debtReceivedPayments).values({
          debtInterestPeriodId: periodId,
          amount: String(parsedAmount),
          receivedDate: receivedDateObj,
        });
      }

      await recordMoneyAudit(tx, {
        actorUserId,
        entityType: "debt",
        entityId: period.debtId,
        loanId: period.debtId,
        action: "consolidate",
        before: {
          amount: expectedAmount,
          linkedPayments: priorRows.map((row) => row.amount),
        },
        after: { amount: parsedAmount, keptPaymentId: keep?.id ?? null },
      });
    });

    await recalculateDebtInterestPeriodStatus(periodId);

    invalidateDebtData();
    return json({ success: true });
  } catch (error) {
    console.error("Error consolidating debt payment:", error);
    return json({ error: "Failed to update payment" }, { status: 500 });
  }
};
