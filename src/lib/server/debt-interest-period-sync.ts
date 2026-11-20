import { db } from "$lib/server/db";
import {
  debtInterestPeriods,
  debtReceivedPayments,
  debts,
} from "$lib/server/db/schema";
import { and, eq, inArray, isNull } from "drizzle-orm";
import {
  calculateDebtSummary,
  normalizeDebtFees,
} from "$lib/debt-calculations";
import { toCentavos } from "$lib/money/centavos";
import { isAfterDueDate, toDateKey, todayKey } from "$lib/dates/business-date";

export const DEBT_AMOUNT_TOLERANCE = 0;

function derivePeriodStatus(
  paidTotal: number,
  expectedInstallment: number,
  dueDate: Date | string,
): "Pending" | "Overdue" | "Incomplete" | "Completed" {
  const paidC = toCentavos(paidTotal);
  const expectedC = toCentavos(expectedInstallment);
  if (paidC <= 0) {
    return isAfterDueDate(toDateKey(dueDate), todayKey())
      ? "Overdue"
      : "Pending";
  }
  if (paidC >= expectedC) return "Completed";
  return "Incomplete";
}

type DbClient = typeof db;

export async function recalculateDebtInterestPeriodStatus(
  periodId: number,
  client: DbClient = db,
): Promise<void> {
  const period = await client.query.debtInterestPeriods.findFirst({
    where: eq(debtInterestPeriods.id, periodId),
    with: {
      receivedPayments: { where: isNull(debtReceivedPayments.deletedAt) },
    },
  });
  if (!period) return;

  const paidTotal = (period.receivedPayments ?? []).reduce(
    (sum, payment) => sum + (parseFloat(payment.amount) || 0),
    0,
  );
  const expectedAmount = parseFloat(period.expectedInstallment) || 0;
  const status = derivePeriodStatus(
    paidTotal,
    expectedAmount,
    new Date(period.dueDate),
  );

  await client
    .update(debtInterestPeriods)
    .set({ status, updatedAt: new Date() })
    .where(eq(debtInterestPeriods.id, periodId));
}

export async function syncDebtInterestPeriods(
  debtId: number,
  client: DbClient = db,
): Promise<void> {
  const debt = await client.query.debts.findFirst({
    where: and(eq(debts.id, debtId), isNull(debts.deletedAt)),
  });
  if (!debt) return;

  const debtDate =
    debt.date instanceof Date ? toDateKey(debt.date) : toDateKey(debt.date);

  const summary = calculateDebtSummary({
    principal: debt.amount,
    interestRate: debt.interestRate,
    interestInterval: debt.interestInterval,
    debtDate,
    additionalFees: normalizeDebtFees(debt.additionalFees ?? []),
    durationMonths: debt.durationMonths,
  });

  const existing = await client.query.debtInterestPeriods.findMany({
    where: eq(debtInterestPeriods.debtId, debtId),
    with: {
      receivedPayments: { where: isNull(debtReceivedPayments.deletedAt) },
    },
  });
  const existingByNumber = new Map(
    existing.map((period) => [period.periodNumber, period]),
  );

  // Batch writes: one update per distinct (due date, expected, status), one
  // insert for new periods, and one delete for removed empty periods. A
  // 12-month debt used to run 12+ round trips per save (T10.2).
  type PeriodUpdate = {
    dueDate: Date;
    expectedInstallment: string;
    status: "Pending" | "Overdue" | "Incomplete" | "Completed";
    ids: number[];
  };
  const updatesByKey = new Map<string, PeriodUpdate>();
  const inserts: Array<typeof debtInterestPeriods.$inferInsert> = [];
  const now = new Date();

  const queueUpdate = (
    id: number,
    dueDate: Date,
    expectedInstallment: string,
    status: "Pending" | "Overdue" | "Incomplete" | "Completed",
  ) => {
    const key = `${dueDate.toISOString()}|${expectedInstallment}|${status}`;
    const entry = updatesByKey.get(key);
    if (entry) {
      entry.ids.push(id);
      return;
    }
    updatesByKey.set(key, { dueDate, expectedInstallment, status, ids: [id] });
  };

  for (const entry of summary.schedule) {
    const expectedAmount = entry.periodDue.toFixed(2);
    const dueDate = entry.date;
    const current = existingByNumber.get(entry.period);

    if (current) {
      // `expected_installment` stores the full installment (principal + interest)
      // because payments are matched against the installment (DEBT-04).
      const paidTotal = (current.receivedPayments ?? []).reduce(
        (sum, payment) => sum + (parseFloat(payment.amount) || 0),
        0,
      );
      const status = derivePeriodStatus(paidTotal, entry.periodDue, dueDate);
      const unchanged =
        current.dueDate.getTime() === dueDate.getTime() &&
        Number(current.expectedInstallment) === Number(expectedAmount) &&
        current.status === status;
      existingByNumber.delete(entry.period);
      if (unchanged) continue;
      queueUpdate(current.id, dueDate, expectedAmount, status);
      continue;
    }

    inserts.push({
      debtId,
      periodNumber: entry.period,
      dueDate,
      expectedInstallment: expectedAmount,
      status: derivePeriodStatus(0, entry.periodDue, dueDate),
    });
  }

  for (const update of updatesByKey.values()) {
    await client
      .update(debtInterestPeriods)
      .set({
        dueDate: update.dueDate,
        expectedInstallment: update.expectedInstallment,
        status: update.status,
        updatedAt: now,
      })
      .where(inArray(debtInterestPeriods.id, update.ids));
  }

  if (inserts.length > 0) {
    await client.insert(debtInterestPeriods).values(inserts);
  }

  // Stale periods outside the new schedule are removed only when no payment
  // row ever pointed at them. A period with history (even soft-deleted) stays
  // so the money trail is not destroyed by a schedule edit.
  const stalePeriods = [...existingByNumber.values()];
  if (stalePeriods.length > 0) {
    const historical = await client.query.debtReceivedPayments.findMany({
      where: inArray(
        debtReceivedPayments.debtInterestPeriodId,
        stalePeriods.map((period) => period.id),
      ),
      columns: { debtInterestPeriodId: true },
    });
    const locked = new Set(
      historical.map((payment) => payment.debtInterestPeriodId),
    );
    const removable = stalePeriods
      .filter((period) => !locked.has(period.id))
      .map((period) => period.id);
    if (removable.length > 0) {
      await client
        .delete(debtInterestPeriods)
        .where(inArray(debtInterestPeriods.id, removable));
    }
  }
}

export async function markOverdueDebtInterestPeriods(
  debtId: number,
  client: DbClient = db,
): Promise<void> {
  const periods = await client.query.debtInterestPeriods.findMany({
    where: eq(debtInterestPeriods.debtId, debtId),
    with: {
      receivedPayments: { where: isNull(debtReceivedPayments.deletedAt) },
    },
  });

  const now = new Date();
  const idsByStatus = new Map<
    "Pending" | "Overdue" | "Incomplete" | "Completed",
    number[]
  >();
  for (const period of periods) {
    const paidTotal = (period.receivedPayments ?? []).reduce(
      (sum, payment) => sum + (parseFloat(payment.amount) || 0),
      0,
    );
    const expectedAmount = parseFloat(period.expectedInstallment) || 0;
    const status = derivePeriodStatus(
      paidTotal,
      expectedAmount,
      new Date(period.dueDate),
    );
    if (status === period.status) continue;
    const ids = idsByStatus.get(status) ?? [];
    ids.push(period.id);
    idsByStatus.set(status, ids);
  }

  for (const [status, ids] of idsByStatus) {
    await client
      .update(debtInterestPeriods)
      .set({ status, updatedAt: now })
      .where(inArray(debtInterestPeriods.id, ids));
  }
}

export async function deleteDebtReceivedPaymentsForPeriod(
  periodId: number,
): Promise<void> {
  // Soft delete (D-8): the row stays for the audit trail.
  await db
    .update(debtReceivedPayments)
    .set({ deletedAt: new Date(), updatedAt: new Date() })
    .where(
      and(
        eq(debtReceivedPayments.debtInterestPeriodId, periodId),
        isNull(debtReceivedPayments.deletedAt),
      ),
    );
}
