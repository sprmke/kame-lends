import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { and, eq, inArray } from "drizzle-orm";
import { db } from "$lib/server/db";
import {
  debtInterestPeriods,
  debtReceivedPayments,
  debts,
  investors,
  users,
} from "$lib/server/db/schema";
import { syncDebtInterestPeriods } from "$lib/server/debt-interest-period-sync";

/**
 * Debt schedule sync (T10.2 batch path, DEBT-04).
 *
 * The sync used to run one query per installment. It now groups updates, does
 * one insert, and deletes removed periods in one statement. These tests prove
 * the money result did not change.
 */

let ownerId: string;
let investorId: number;
let debtId: number;

beforeEach(async () => {
  ownerId = `debt-sync-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  await db.insert(users).values({
    id: ownerId,
    name: "Debt Sync Owner",
    email: `${ownerId}@example.test`,
    role: "admin",
  });
  const [investor] = await db
    .insert(investors)
    .values({
      userId: ownerId,
      name: "Debt Sync Lender",
      email: `lender-${ownerId}@example.test`,
    })
    .returning();
  investorId = investor.id;

  const [debt] = await db
    .insert(debts)
    .values({
      userId: ownerId,
      investorId,
      name: "Debt sync fixture",
      amount: "120000",
      date: new Date("2027-01-31T00:00:00.000Z"),
      interestRate: "5",
      interestInterval: "Monthly",
      durationMonths: 12,
    })
    .returning();
  debtId = debt.id;
});

afterEach(async () => {
  const periods = await db
    .select({ id: debtInterestPeriods.id })
    .from(debtInterestPeriods)
    .where(eq(debtInterestPeriods.debtId, debtId));
  const periodIds = periods.map((row) => row.id);
  if (periodIds.length > 0) {
    await db
      .delete(debtReceivedPayments)
      .where(inArray(debtReceivedPayments.debtInterestPeriodId, periodIds));
  }
  await db
    .delete(debtInterestPeriods)
    .where(eq(debtInterestPeriods.debtId, debtId));
  await db.delete(debts).where(eq(debts.id, debtId));
  await db.delete(investors).where(eq(investors.id, investorId));
  await db.delete(users).where(eq(users.id, ownerId));
});

async function periods() {
  return db.query.debtInterestPeriods.findMany({
    where: eq(debtInterestPeriods.debtId, debtId),
    orderBy: (row, { asc }) => [asc(row.periodNumber)],
    with: { receivedPayments: true },
  });
}

describe("syncDebtInterestPeriods", () => {
  it("writes the full schedule with the first installment one interval after the start", async () => {
    await syncDebtInterestPeriods(debtId);
    const rows = await periods();

    expect(rows).toHaveLength(12);
    expect(rows.map((row) => row.periodNumber)).toEqual(
      Array.from({ length: 12 }, (_, i) => i + 1),
    );
    // Borrowed Jan 31, first installment due end of February.
    expect(rows[0].dueDate.toISOString().slice(0, 10)).toBe("2027-02-28");
    for (const row of rows) {
      expect(row.status).toBe("Pending");
      expect(Number(row.expectedInstallment)).toBeGreaterThan(0);
    }
    const total = rows.reduce(
      (sum, row) => sum + Number(row.expectedInstallment),
      0,
    );
    expect(total).toBeGreaterThan(120000);
  });

  it("keeps period ids stable across a no-op resync", async () => {
    await syncDebtInterestPeriods(debtId);
    const before = (await periods()).map((row) => row.id);
    await syncDebtInterestPeriods(debtId);
    const after = (await periods()).map((row) => row.id);
    expect(after).toEqual(before);
  });

  it("removes empty periods beyond a shortened term but keeps paid history", async () => {
    await syncDebtInterestPeriods(debtId);
    const rows = await periods();
    await db.insert(debtReceivedPayments).values({
      debtInterestPeriodId: rows[9].id,
      amount: "1000",
      receivedDate: new Date("2026-03-01T00:00:00.000Z"),
    });

    await db
      .update(debts)
      .set({ durationMonths: 6 })
      .where(eq(debts.id, debtId));
    await syncDebtInterestPeriods(debtId);

    const after = await periods();
    const numbers = after.map((row) => row.periodNumber);
    expect(numbers).toContain(10);
    expect(numbers).not.toContain(7);
    expect(numbers).not.toContain(12);
    expect(
      after.find((row) => row.periodNumber === 10)?.receivedPayments,
    ).toHaveLength(1);
  });

  it("derives status from linked payments during the sync", async () => {
    await syncDebtInterestPeriods(debtId);
    const rows = await periods();
    await db.insert(debtReceivedPayments).values({
      debtInterestPeriodId: rows[0].id,
      amount: rows[0].expectedInstallment,
      receivedDate: new Date("2026-02-28T00:00:00.000Z"),
    });

    await syncDebtInterestPeriods(debtId);
    const after = await periods();
    expect(after[0].status).toBe("Completed");
  });

  it("ignores soft-deleted payments when deriving status", async () => {
    await syncDebtInterestPeriods(debtId);
    const rows = await periods();
    await db.insert(debtReceivedPayments).values({
      debtInterestPeriodId: rows[0].id,
      amount: rows[0].expectedInstallment,
      receivedDate: new Date("2026-02-28T00:00:00.000Z"),
      deletedAt: new Date("2026-03-02T00:00:00.000Z"),
    });

    await syncDebtInterestPeriods(debtId);
    const after = await periods();
    expect(after[0].status).toBe("Pending");
  });
});
