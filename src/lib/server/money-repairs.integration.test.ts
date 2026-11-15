import { execFileSync } from "node:child_process";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { eq, sql } from "drizzle-orm";
import { db, LOCAL_DATABASE_URL } from "$lib/server/db";
import {
  interestPeriods,
  loanInvestors,
  moneyAuditEvents,
  receivedPayments,
} from "$lib/server/db/schema";
import {
  cleanupLoanFixture,
  createLoanFixture,
  type LoanFixture,
} from "$lib/server/test/loan-fixture";

/**
 * Runs the real repair script against the integration Postgres.
 *
 * Duplicate rows cannot exist while the unique constraint is present, so the
 * duplicate test drops it first and lets the repair restore it.
 */

let fixture: LoanFixture;
let backupId: string;

function runRepair(category: string, apply = false): string {
  const args = ["scripts/db/repair/money-repairs.ts", `--category=${category}`];
  if (apply) args.push("--apply", `--backup-id=${backupId}`);
  return execFileSync("bun", args, {
    cwd: process.cwd(),
    encoding: "utf8",
    env: {
      ...process.env,
      DATABASE_URL: process.env.DATABASE_URL ?? LOCAL_DATABASE_URL,
    },
  });
}

async function clearRepairAudit() {
  await db.execute(
    sql`delete from money_audit_events where after->>'backupId' = ${backupId}`,
  );
}

beforeEach(async () => {
  fixture = await createLoanFixture();
  backupId = `test-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
});

afterEach(async () => {
  await clearRepairAudit();
  await cleanupLoanFixture(fixture);
  // Restore the guard if the duplicate test dropped it and the repair could
  // not re-add it because this database still has unrelated duplicates.
  await db.execute(sql`
    do $$
    begin
      if not exists (
        select 1 from pg_constraint
        where conname = 'interest_periods_loan_investor_due_date_unique'
      ) and not exists (
        select 1 from interest_periods
        group by loan_investor_id, due_date
        having count(*) > 1
      ) then
        alter table interest_periods
          add constraint interest_periods_loan_investor_due_date_unique
          unique (loan_investor_id, due_date);
      end if;
    end $$;
  `);
});

describe("money repairs", () => {
  it("merges duplicate period dates and moves payments to the keeper", async () => {
    await db.execute(
      sql`alter table interest_periods drop constraint if exists interest_periods_loan_investor_due_date_unique`,
    );
    const [duplicate] = await db
      .insert(interestPeriods)
      .values({
        loanInvestorId: fixture.keepAllocationId,
        dueDate: new Date("2026-06-30T00:00:00.000Z"),
        interestRate: "5",
        interestType: "rate",
        status: "Pending",
      })
      .returning();
    const [payment] = await db
      .insert(receivedPayments)
      .values({
        loanInvestorId: fixture.keepAllocationId,
        interestPeriodId: duplicate.id,
        amount: "1000",
        receivedDate: new Date("2026-04-01T00:00:00.000Z"),
      })
      .returning();

    const dry = runRepair("duplicate-period-dates");
    expect(dry).toContain("duplicate periods: 1");
    expect(dry).toContain(String(duplicate.id));

    const applied = runRepair("duplicate-period-dates", true);
    expect(applied).toContain("deleted 1 duplicate period(s)");

    const periods = await db
      .select({ id: interestPeriods.id })
      .from(interestPeriods)
      .where(eq(interestPeriods.loanInvestorId, fixture.keepAllocationId));
    expect(periods.map((row) => row.id)).toEqual([fixture.keepPeriodId]);

    const [moved] = await db
      .select({ interestPeriodId: receivedPayments.interestPeriodId })
      .from(receivedPayments)
      .where(eq(receivedPayments.id, payment.id));
    expect(moved.interestPeriodId).toBe(fixture.keepPeriodId);

    const [audit] = await db
      .select({ reason: moneyAuditEvents.reason })
      .from(moneyAuditEvents)
      .where(sql`${moneyAuditEvents.after}->>'backupId' = ${backupId}`);
    expect(audit?.reason).toBe("repair:duplicate-period-dates");
  });

  it("converts zero-capital fixed allocations without changing the amount", async () => {
    await db
      .update(loanInvestors)
      .set({ amount: "0", interestType: "fixed", interestRate: "5000" })
      .where(eq(loanInvestors.id, fixture.keepAllocationId));

    const dry = runRepair("zero-capital-fixed");
    expect(dry).toContain("zero-capital fixed allocations: 1");

    runRepair("zero-capital-fixed", true);

    const [row] = await db
      .select({
        interestType: loanInvestors.interestType,
        interestRate: loanInvestors.interestRate,
      })
      .from(loanInvestors)
      .where(eq(loanInvestors.id, fixture.keepAllocationId));
    expect(row.interestType).toBe("rate");
    // Keep allocation becomes 0, so the loan total is the 50000 drop row.
    expect(Number(row.interestRate)).toBeCloseTo(10, 2);
  });

  it("reports receipt-less payments without writing", async () => {
    const [payment] = await db
      .insert(receivedPayments)
      .values({
        loanInvestorId: fixture.keepAllocationId,
        interestPeriodId: fixture.keepPeriodId,
        amount: "5000",
        receivedDate: new Date("2026-06-30T00:00:00.000Z"),
      })
      .returning();

    const output = runRepair("receiptless-created-payments");
    expect(output).toContain(String(payment.id));
    expect(output).toContain("No automatic action");

    const [stillThere] = await db
      .select({ id: receivedPayments.id })
      .from(receivedPayments)
      .where(eq(receivedPayments.id, payment.id));
    expect(stillThere.id).toBe(payment.id);
  });

  it("reports unlinked payments without writing", async () => {
    const [payment] = await db
      .insert(receivedPayments)
      .values({
        loanInvestorId: fixture.keepAllocationId,
        interestPeriodId: null,
        amount: "2500",
        receivedDate: new Date("2026-04-01T00:00:00.000Z"),
      })
      .returning();

    const output = runRepair("unlinked-payments");
    expect(output).toContain(String(payment.id));
    expect(output).toContain("No automatic action");

    const [stillThere] = await db
      .select({ id: receivedPayments.id })
      .from(receivedPayments)
      .where(eq(receivedPayments.id, payment.id));
    expect(stillThere.id).toBe(payment.id);
  });
});
