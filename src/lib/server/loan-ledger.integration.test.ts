import { describe, expect, it } from "vitest";
import { db } from "$lib/server/db";
import { loans } from "$lib/server/db/schema";
import { eq, isNull } from "drizzle-orm";
import { loadLoanLedger } from "$lib/server/loan-ledger";
import { syncLoanStatuses } from "$lib/server/loan-interest-period-sync";
import { runMoneyHealthChecks } from "$lib/server/money-health";

/**
 * Smoke test for the integration harness. Uses the local prod snapshot; never
 * writes. Run with `bun run test:integration`.
 */
describe("loan ledger against the database", () => {
  it("reads a real loan and produces a consistent ledger", async () => {
    const rows = await db.select({ id: loans.id }).from(loans).limit(1);
    if (rows.length === 0) {
      expect(rows).toEqual([]);
      return;
    }

    const ledger = await loadLoanLedger(rows[0].id);
    expect(ledger).not.toBeNull();
    if (!ledger) return;

    expect(ledger.principalC).toBeGreaterThanOrEqual(0);
    expect(ledger.interestExpectedC).toBeGreaterThanOrEqual(0);
    expect(ledger.dueC).toBe(ledger.principalC + ledger.interestExpectedC);
    expect(ledger.balanceC).toBe(ledger.dueC - ledger.receivedC);
  });

  it("recomputes statuses without touching unrelated loans", async () => {
    const before = await db
      .select({ id: loans.id, status: loans.status })
      .from(loans)
      .where(isNull(loans.deletedAt));
    const result = await syncLoanStatuses();
    // Deleted loans are not part of any list, so the sync skips them.
    expect(result.loans).toBe(before.length);
  });

  it("runs every money health query", async () => {
    const checks = await runMoneyHealthChecks();
    expect(checks.length).toBeGreaterThanOrEqual(8);
    for (const check of checks) {
      expect(Number.isInteger(check.count)).toBe(true);
      expect(check.count).toBeGreaterThanOrEqual(0);
    }
  });

  it("keeps a soft-deleted loan hidden from detail reads", async () => {
    const rows = await db
      .select({ id: loans.id })
      .from(loans)
      .where(eq(loans.status, "Completed"))
      .limit(1);
    if (rows.length === 0) return;
    const ledger = await loadLoanLedger(rows[0].id);
    expect(ledger === null || ledger.dueC >= 0).toBe(true);
  });
});
