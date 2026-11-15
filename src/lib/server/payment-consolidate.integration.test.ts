import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { and, eq } from "drizzle-orm";
import { db } from "$lib/server/db";
import { moneyAuditEvents, receivedPayments } from "$lib/server/db/schema";
import { POST } from "../../routes/api/interest-periods/[id]/consolidate-payment/+server";
import {
  cleanupLoanFixture,
  createLoanFixture,
  ownerEvent,
  routeHandler,
  type LoanFixture,
} from "$lib/server/test/loan-fixture";

/**
 * Consolidating partial payments must merge, not destroy (DATA-06, D-8).
 * Local Docker Postgres only (see integration-setup.ts).
 */

const RECEIPT = {
  imageUrl: "storage:receipts/consolidate-test.png",
  extractedData: null,
};
const consolidatePayment = routeHandler(POST);

describe("consolidate payment keeps the first row in place", () => {
  let fixture: LoanFixture;

  beforeEach(async () => {
    fixture = await createLoanFixture();
  });

  afterEach(async () => {
    await cleanupLoanFixture(fixture);
  });

  function consolidateEvent(fixture: LoanFixture, body: unknown) {
    return ownerEvent(fixture, {
      params: { id: String(fixture.keepPeriodId) },
      method: "POST",
      body,
    });
  }

  it("updates the existing payment instead of deleting and re-inserting", async () => {
    const response = await consolidatePayment(
      consolidateEvent(fixture, {
        amount: "5000",
        receivedDate: "2026-03-02",
        receipts: [RECEIPT],
      }),
    );
    expect(response.status).toBe(200);

    const linked = await db
      .select({
        id: receivedPayments.id,
        amount: receivedPayments.amount,
        deletedAt: receivedPayments.deletedAt,
        receipts: receivedPayments.receipts,
      })
      .from(receivedPayments)
      .where(eq(receivedPayments.interestPeriodId, fixture.keepPeriodId));

    expect(linked).toHaveLength(1);
    expect(linked[0].id).toBe(fixture.keepPaymentId);
    expect(linked[0].deletedAt).toBeNull();
    expect(linked[0].amount).toBe("5000.00");
    expect(linked[0].receipts).toHaveLength(1);

    const audit = await db
      .select({ id: moneyAuditEvents.id })
      .from(moneyAuditEvents)
      .where(
        and(
          eq(moneyAuditEvents.loanId, fixture.loanId),
          eq(moneyAuditEvents.action, "consolidate"),
        ),
      );
    expect(audit.length).toBeGreaterThan(0);
  });

  it("soft-deletes extra partial payments and keeps their receipts", async () => {
    const extras = await db
      .insert(receivedPayments)
      .values([
        {
          loanInvestorId: fixture.keepAllocationId,
          interestPeriodId: fixture.keepPeriodId,
          amount: "1500",
          receivedDate: new Date("2026-03-03T00:00:00.000Z"),
          receipts: [
            { imageUrl: "storage:receipts/extra-1.png", extractedData: null },
          ],
        },
        {
          loanInvestorId: fixture.keepAllocationId,
          interestPeriodId: fixture.keepPeriodId,
          amount: "1000",
          receivedDate: new Date("2026-03-04T00:00:00.000Z"),
          receipts: [
            { imageUrl: "storage:receipts/extra-2.png", extractedData: null },
          ],
        },
      ] satisfies (typeof receivedPayments.$inferInsert)[])
      .returning();

    const response = await consolidatePayment(
      consolidateEvent(fixture, {
        amount: "5000",
        receivedDate: "2026-03-05",
        receipts: [RECEIPT],
      }),
    );
    expect(response.status).toBe(200);

    const rows = await db
      .select({
        id: receivedPayments.id,
        deletedAt: receivedPayments.deletedAt,
        receipts: receivedPayments.receipts,
      })
      .from(receivedPayments)
      .where(eq(receivedPayments.interestPeriodId, fixture.keepPeriodId));

    const kept = rows.find((row) => row.id === fixture.keepPaymentId);
    expect(kept?.deletedAt).toBeNull();
    expect(kept?.receipts.map((receipt) => receipt.imageUrl).sort()).toEqual([
      "storage:receipts/consolidate-test.png",
      "storage:receipts/extra-1.png",
      "storage:receipts/extra-2.png",
    ]);

    for (const extra of extras) {
      const row = rows.find((item) => item.id === extra.id);
      expect(row?.deletedAt).not.toBeNull();
    }
  });
});
