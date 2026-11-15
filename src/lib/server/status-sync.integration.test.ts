import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { db } from "$lib/server/db";
import {
  interestPeriods,
  loans,
  receivedPayments,
} from "$lib/server/db/schema";
import { syncLoanStatuses } from "$lib/server/loan-interest-period-sync";
import { loadStatusDrift } from "$lib/server/status-drift";
import { runMoneyHealthChecks } from "$lib/server/money-health";
import { HEALTH_CHECKS } from "$lib/money/health-checks";
import {
  cleanupLoanFixture,
  createLoanFixture,
  type LoanFixture,
} from "$lib/server/test/loan-fixture";

/**
 * Status sweep and health drift use one ledger rule.
 *
 * The fixture allocation is 100000 at 5%, so one period expects 5000. Its
 * period is past due relative to the test clock (2026-06-30 vs November 2026).
 */
describe("status sweep and drift", () => {
  let fixture: LoanFixture;

  beforeEach(async () => {
    fixture = await createLoanFixture();
  });

  afterEach(async () => {
    await cleanupLoanFixture(fixture);
  });

  async function setPeriodStatus(
    status: "Completed" | "Incomplete" | "Pending",
  ) {
    await db
      .update(interestPeriods)
      .set({ status })
      .where(eq(interestPeriods.id, fixture.keepPeriodId));
  }

  async function softDeleteLinkedPayment() {
    await db
      .update(receivedPayments)
      .set({ deletedAt: new Date() })
      .where(eq(receivedPayments.id, fixture.keepPaymentId));
  }

  it("reports every shared health check plus ledger drift", async () => {
    const checks = await runMoneyHealthChecks();
    expect(checks.map((row) => row.id)).toEqual([
      ...HEALTH_CHECKS.map((row) => row.id),
      "period-status-drift",
      "loan-status-drift",
    ]);
  });

  it("detects a completed period with no payment and clears it", async () => {
    await softDeleteLinkedPayment();
    await setPeriodStatus("Completed");

    const before = await loadStatusDrift();
    expect(
      before.periods.some(
        (row) =>
          row.periodId === fixture.keepPeriodId &&
          row.loanId === fixture.loanId &&
          row.derived === "Overdue",
      ),
    ).toBe(true);

    const health = await runMoneyHealthChecks();
    const driftCheck = health.find((row) => row.id === "period-status-drift");
    expect(driftCheck?.count).toBeGreaterThan(0);
    expect(JSON.stringify(driftCheck?.sample)).toContain(
      String(fixture.keepPeriodId),
    );

    const result = await syncLoanStatuses({ userId: fixture.ownerId });
    expect(result.updatedPeriods).toBeGreaterThan(0);

    const after = await loadStatusDrift();
    expect(
      after.periods.some((row) => row.periodId === fixture.keepPeriodId),
    ).toBe(false);
  });

  it("accepts a completed period covered by unlinked money", async () => {
    await softDeleteLinkedPayment();
    await db.insert(receivedPayments).values({
      loanInvestorId: fixture.keepAllocationId,
      interestPeriodId: null,
      amount: "5000",
      receivedDate: new Date("2026-03-02T00:00:00.000Z"),
    });
    await setPeriodStatus("Completed");

    const drift = await loadStatusDrift();
    expect(
      drift.periods.some((row) => row.periodId === fixture.keepPeriodId),
    ).toBe(false);
  });

  it("accepts a completed period with a linked payment", async () => {
    await setPeriodStatus("Completed");

    const drift = await loadStatusDrift();
    expect(
      drift.periods.some((row) => row.periodId === fixture.keepPeriodId),
    ).toBe(false);
  });

  it("flags and repairs a stale completed loan with a balance", async () => {
    await db
      .update(loans)
      .set({
        status: "Completed",
        dueDate: new Date("2026-06-30T00:00:00.000Z"),
      })
      .where(eq(loans.id, fixture.loanId));

    const before = await loadStatusDrift();
    const loanDrift = before.loans.find((row) => row.loanId === fixture.loanId);
    expect(loanDrift).toMatchObject({
      stored: "Completed",
      derived: "Overdue",
    });

    await syncLoanStatuses({ userId: fixture.ownerId });

    const [row] = await db
      .select({ status: loans.status })
      .from(loans)
      .where(eq(loans.id, fixture.loanId));
    expect(row.status).toBe("Overdue");
    const after = await loadStatusDrift();
    expect(after.loans.some((item) => item.loanId === fixture.loanId)).toBe(
      false,
    );
  });

  it("keeps an overdue loan with unpaid principal and no overdue period", async () => {
    // Only principal remains: the period is paid, the loan due date is past.
    await db
      .update(loans)
      .set({ dueDate: new Date("2026-06-30T00:00:00.000Z"), status: "Overdue" })
      .where(eq(loans.id, fixture.loanId));
    await db
      .update(interestPeriods)
      .set({ status: "Completed" })
      .where(eq(interestPeriods.id, fixture.keepPeriodId));

    const drift = await loadStatusDrift();
    expect(drift.loans.some((row) => row.loanId === fixture.loanId)).toBe(
      false,
    );
    expect(
      drift.periods.some((row) => row.periodId === fixture.keepPeriodId),
    ).toBe(false);
  });
});
