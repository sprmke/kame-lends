import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { and, eq } from "drizzle-orm";
import { db } from "$lib/server/db";
import {
  interestPeriods,
  loanInvestors,
  moneyAuditEvents,
  receivedPayments,
} from "$lib/server/db/schema";
import { PUT } from "../../routes/api/loans/[id]/+server";
import {
  cleanupLoanFixture,
  createLoanFixture,
  ownerEvent,
  routeHandler,
  type LoanFixture,
} from "$lib/server/test/loan-fixture";

/**
 * Data integrity of the loan edit reconcile (DATA-01, DATA-07, ARCH-01).
 * Local Docker Postgres only (see integration-setup.ts).
 */

const putLoan = routeHandler(PUT);

function putEvent(fixture: LoanFixture, body: unknown) {
  return ownerEvent(fixture, {
    params: { id: String(fixture.loanId) },
    method: "PUT",
    body,
  });
}

/** Payload that keeps only the first investor. */
function keepOnlyOneInvestor(fixture: LoanFixture, confirmRemovals = false) {
  return {
    loanData: {
      borrowerId: fixture.borrowerId,
      loanName: fixture.loanName,
      type: fixture.type,
      dueDate: fixture.dueDate,
      freeLotSqm: null,
      notes: null,
    },
    investorData: [
      {
        id: fixture.keepAllocationId,
        investorId: fixture.keepInvestorId,
        amount: "100000",
        interestRate: "5",
        interestType: "rate",
        sentDate: "2026-01-15",
        isPaid: true,
        hasMultipleInterest: true,
        interestPeriods: [
          {
            id: fixture.keepPeriodId,
            dueDate: "2026-06-30",
            interestRate: "5",
            interestType: "rate",
          },
        ],
      },
    ],
    receivedPaymentsByInvestor: [
      {
        investorId: fixture.keepInvestorId,
        receivedPayments: [
          {
            id: fixture.keepPaymentId,
            interestPeriodId: fixture.keepPeriodId,
            amount: "5000",
            receivedDate: "2026-03-01",
          },
        ],
      },
    ],
    confirmRemovals,
  };
}

async function allocationState(allocationId: number) {
  const [row] = await db
    .select({ deletedAt: loanInvestors.deletedAt })
    .from(loanInvestors)
    .where(eq(loanInvestors.id, allocationId));
  return row?.deletedAt ?? null;
}

describe("loan edit reconcile removes dropped investors", () => {
  let fixture: LoanFixture;

  beforeEach(async () => {
    fixture = await createLoanFixture();
  });

  afterEach(async () => {
    await cleanupLoanFixture(fixture);
  });

  it("soft-deletes the allocation of an investor removed from the form", async () => {
    const response = await putLoan(
      putEvent(fixture, keepOnlyOneInvestor(fixture)),
    );
    expect(response.status).toBe(200);

    expect(await allocationState(fixture.dropAllocationId)).not.toBeNull();
    expect(await allocationState(fixture.keepAllocationId)).toBeNull();

    const droppedPeriods = await db
      .select({ id: interestPeriods.id })
      .from(interestPeriods)
      .where(eq(interestPeriods.loanInvestorId, fixture.dropAllocationId));
    expect(droppedPeriods).toEqual([]);
  });

  it("refuses to drop an investor that still has recorded payments", async () => {
    await db.insert(receivedPayments).values({
      loanInvestorId: fixture.dropAllocationId,
      amount: "2500",
      receivedDate: new Date("2026-04-01T00:00:00.000Z"),
    });

    const blocked = await putLoan(
      putEvent(fixture, keepOnlyOneInvestor(fixture)),
    );
    expect(blocked.status).toBe(409);
    expect(await allocationState(fixture.dropAllocationId)).toBeNull();
  });

  it("soft-deletes the dropped investor's payments only when confirmed", async () => {
    const [droppedPayment] = await db
      .insert(receivedPayments)
      .values({
        loanInvestorId: fixture.dropAllocationId,
        amount: "2500",
        receivedDate: new Date("2026-04-01T00:00:00.000Z"),
      })
      .returning();

    const confirmed = await putLoan(
      putEvent(fixture, keepOnlyOneInvestor(fixture, true)),
    );
    expect(confirmed.status).toBe(200);

    expect(await allocationState(fixture.dropAllocationId)).not.toBeNull();
    const [paymentAfter] = await db
      .select({ deletedAt: receivedPayments.deletedAt })
      .from(receivedPayments)
      .where(eq(receivedPayments.id, droppedPayment.id));
    expect(paymentAfter.deletedAt).not.toBeNull();

    const audit = await db
      .select({ id: moneyAuditEvents.id })
      .from(moneyAuditEvents)
      .where(
        and(
          eq(moneyAuditEvents.loanId, fixture.loanId),
          eq(moneyAuditEvents.action, "update"),
        ),
      );
    expect(audit.length).toBeGreaterThan(0);
  });

  it("refuses a stale allocation id instead of reviving a deleted row", async () => {
    await db
      .update(loanInvestors)
      .set({ deletedAt: new Date("2026-05-01T00:00:00.000Z") })
      .where(eq(loanInvestors.id, fixture.dropAllocationId));

    const body = keepOnlyOneInvestor(fixture);
    body.investorData.push({
      id: fixture.dropAllocationId,
      investorId: fixture.dropInvestorId,
      amount: "50000",
      interestRate: "5",
      interestType: "rate",
      sentDate: "2026-01-15",
      isPaid: true,
      hasMultipleInterest: false,
      receipts: [
        { imageUrl: "storage:receipts/stale-row.png", extractedData: null },
      ],
      interestPeriods: [],
    } as (typeof body.investorData)[number]);

    const response = await putLoan(putEvent(fixture, body));
    expect(response.status).toBe(409);

    const rows = await db
      .select({ id: loanInvestors.id, deletedAt: loanInvestors.deletedAt })
      .from(loanInvestors)
      .where(
        and(
          eq(loanInvestors.loanId, fixture.loanId),
          eq(loanInvestors.investorId, fixture.dropInvestorId),
        ),
      );
    expect(rows.length).toBe(1);
    expect(rows[0].deletedAt).not.toBeNull();
  });
});
