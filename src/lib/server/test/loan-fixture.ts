/**
 * Throwaway money fixtures for database integration tests.
 *
 * Everything is scoped to a fresh owner user, so cleanup is a single delete and
 * never touches the restored snapshot.
 */
import { eq, inArray } from "drizzle-orm";
import type { RequestEvent } from "@sveltejs/kit";
import { db } from "$lib/server/db";
import {
  borrowers,
  interestPeriods,
  investors,
  loanInvestors,
  loans,
  moneyAuditEvents,
  receivedPayments,
  users,
} from "$lib/server/db/schema";

let fixtureId = 0;

export interface LoanFixture {
  ownerId: string;
  loanId: number;
  borrowerId: number;
  keepInvestorId: number;
  dropInvestorId: number;
  keepAllocationId: number;
  dropAllocationId: number;
  keepPaymentId: number;
  keepPeriodId: number;
  loanName: string;
  dueDate: string;
  type: "Lot Title" | "OR/CR" | "Agent";
}

export async function createLoanFixture(): Promise<LoanFixture> {
  fixtureId += 1;
  const tag = `${Date.now()}-${fixtureId}`;
  const ownerId = `test-money-owner-${tag}`;

  await db.insert(users).values({
    id: ownerId,
    name: "Money Fixture Owner",
    email: `money-${tag}@example.test`,
    role: "admin",
  });

  const [borrower] = await db
    .insert(borrowers)
    .values({
      userId: ownerId,
      name: "Money Fixture Borrower",
      email: `borrower-${tag}@example.test`,
    })
    .returning();

  const investorRows = await db
    .insert(investors)
    .values([
      {
        userId: ownerId,
        name: "Keep Investor",
        email: `keep-${tag}@example.test`,
      },
      {
        userId: ownerId,
        name: "Drop Investor",
        email: `drop-${tag}@example.test`,
      },
    ])
    .returning();

  const [loan] = await db
    .insert(loans)
    .values({
      userId: ownerId,
      borrowerId: borrower.id,
      loanName: `Fixture loan ${tag}`,
      type: "Lot Title",
      dueDate: new Date("2027-06-30T00:00:00.000Z"),
      status: "Fully Funded",
    })
    .returning();

  const allocations = await db
    .insert(loanInvestors)
    .values([
      {
        loanId: loan.id,
        investorId: investorRows[0].id,
        amount: "100000",
        interestRate: "5",
        interestType: "rate",
        sentDate: new Date("2026-01-15T00:00:00.000Z"),
        isPaid: true,
        hasMultipleInterest: true,
      },
      {
        loanId: loan.id,
        investorId: investorRows[1].id,
        amount: "50000",
        interestRate: "5",
        interestType: "rate",
        sentDate: new Date("2026-01-15T00:00:00.000Z"),
        isPaid: true,
        hasMultipleInterest: false,
      },
    ])
    .returning();

  const [period] = await db
    .insert(interestPeriods)
    .values({
      loanInvestorId: allocations[0].id,
      dueDate: new Date("2026-06-30T00:00:00.000Z"),
      interestRate: "5",
      interestType: "rate",
      status: "Pending",
    })
    .returning();

  const [payment] = await db
    .insert(receivedPayments)
    .values({
      loanInvestorId: allocations[0].id,
      interestPeriodId: period.id,
      amount: "5000",
      receivedDate: new Date("2026-03-01T00:00:00.000Z"),
    })
    .returning();

  return {
    ownerId,
    loanId: loan.id,
    borrowerId: borrower.id,
    keepInvestorId: investorRows[0].id,
    dropInvestorId: investorRows[1].id,
    keepAllocationId: allocations[0].id,
    dropAllocationId: allocations[1].id,
    keepPaymentId: payment.id,
    keepPeriodId: period.id,
    loanName: loan.loanName,
    dueDate: "2027-06-30",
    type: "Lot Title",
  };
}

export async function cleanupLoanFixture(fixture: LoanFixture) {
  const allocationIds = [fixture.keepAllocationId, fixture.dropAllocationId];
  await db
    .delete(receivedPayments)
    .where(inArray(receivedPayments.loanInvestorId, allocationIds));
  await db
    .delete(interestPeriods)
    .where(inArray(interestPeriods.loanInvestorId, allocationIds));
  await db
    .delete(moneyAuditEvents)
    .where(eq(moneyAuditEvents.loanId, fixture.loanId));
  await db
    .delete(loanInvestors)
    .where(eq(loanInvestors.loanId, fixture.loanId));
  await db.delete(loans).where(eq(loans.id, fixture.loanId));
  await db.delete(borrowers).where(eq(borrowers.id, fixture.borrowerId));
  await db
    .delete(investors)
    .where(
      inArray(investors.id, [fixture.keepInvestorId, fixture.dropInvestorId]),
    );
  await db.delete(users).where(eq(users.id, fixture.ownerId));
}

/** Request event signed in as the fixture owner. */
export function ownerEvent(
  fixture: Pick<LoanFixture, "ownerId">,
  options: {
    params: Record<string, string>;
    method?: "GET" | "POST" | "PUT" | "DELETE";
    body?: unknown;
  },
): RequestEvent {
  return {
    params: options.params,
    request: new Request("http://localhost/test", {
      method: options.method ?? "POST",
      headers: { "content-type": "application/json" },
      ...(options.body === undefined
        ? {}
        : { body: JSON.stringify(options.body) }),
    }),
    locals: { session: { user: { id: fixture.ownerId } } },
  } as unknown as RequestEvent;
}

/**
 * SvelteKit route handlers are typed against their own generated route, so a
 * hand-built event needs one cast. Keeps the call sites readable.
 */
export function routeHandler<Args extends unknown[]>(
  handler: (...args: Args) => unknown,
): (event: RequestEvent) => Promise<Response> {
  return handler as unknown as (event: RequestEvent) => Promise<Response>;
}
