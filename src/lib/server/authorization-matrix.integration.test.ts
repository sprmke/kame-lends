import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { RequestEvent } from "@sveltejs/kit";
import { eq, inArray } from "drizzle-orm";
import { db } from "$lib/server/db";
import {
  borrowers,
  debtInterestPeriods,
  debtReceivedPayments,
  debts,
  interestPeriods,
  investors,
  loanGroupLoans,
  loanGroupMembers,
  loanGroups,
  loanWitnesses,
  users,
  witnesses,
} from "$lib/server/db/schema";
import {
  GET as getLoan,
  PUT as putLoan,
  DELETE as deleteLoan,
} from "../../routes/api/loans/[id]/+server";
import { GET as listLoans } from "../../routes/api/loans/+server";
import { POST as createPayment } from "../../routes/api/loans/[id]/received-payments/+server";
import {
  PATCH as patchPayment,
  DELETE as deletePayment,
} from "../../routes/api/received-payments/[id]/+server";
import { PATCH as patchPeriod } from "../../routes/api/interest-periods/[id]/+server";
import { POST as consolidatePeriod } from "../../routes/api/interest-periods/[id]/consolidate-payment/+server";
import { PUT as putInvestor } from "../../routes/api/investors/[id]/+server";
import { PUT as putBorrower } from "../../routes/api/borrowers/[id]/+server";
import { PUT as putWitness } from "../../routes/api/witnesses/[id]/+server";
import {
  GET as getDebt,
  PUT as putDebt,
  DELETE as deleteDebt,
} from "../../routes/api/debts/[id]/+server";
import { PATCH as patchDebtPeriod } from "../../routes/api/debt-interest-periods/[id]/+server";
import { POST as consolidateDebtPeriod } from "../../routes/api/debt-interest-periods/[id]/consolidate-payment/+server";
import {
  PATCH as patchDebtPayment,
  DELETE as deleteDebtPayment,
} from "../../routes/api/debt-received-payments/[id]/+server";
import { GET as moneyHealth } from "../../routes/api/admin/money-health/+server";
import { POST as e2eCleanup } from "../../routes/api/e2e/cleanup/+server";
import { WORKSPACE_OWNER_EMAIL } from "$lib/server/workspace-owner";
import {
  cleanupLoanFixture,
  createLoanFixture,
  routeHandler,
  type LoanFixture,
} from "$lib/server/test/loan-fixture";

/**
 * Authorization matrix (T11.2).
 *
 * One fixture, seven actors: owner, linked investor, linked borrower, linked
 * witness, group viewer, unrelated user, anonymous. Money mutations are owner
 * only; party accounts may view but never write. A non-owner gets 404 (the row
 * must not appear to exist), anonymous gets 401.
 */

type Actor = {
  id: string;
  email: string;
  role: "admin" | "investor";
};

interface MatrixFixture extends LoanFixture {
  otherId: string;
  investorUserId: string;
  borrowerUserId: string;
  witnessUserId: string;
  groupViewerUserId: string;
  witnessRowId: number;
  groupId: number;
  debtId: number;
  debtPeriodId: number;
  debtPaymentId: number;
  sparePeriodId: number;
}

let fixture: MatrixFixture;
let actors: Record<
  "owner" | "investor" | "borrower" | "witness" | "group" | "other",
  Actor
>;
let workspaceOwner: Actor;
let keepInvestorEmail: string;

async function insertUser(suffix: string, role: "admin" | "investor") {
  const id = `authz-${suffix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const email = `${id}@example.test`;
  await db.insert(users).values({ id, name: `Authz ${suffix}`, email, role });
  return { id, email, role } satisfies Actor;
}

beforeAll(async () => {
  const base = await createLoanFixture();

  const other = await insertUser("other", "admin");
  const investorUser = await insertUser("investor", "investor");
  const borrowerUser = await insertUser("borrower", "investor");
  const witnessUser = await insertUser("witness", "investor");
  const groupViewer = await insertUser("group", "investor");

  const keepInvestorRow = await db.query.investors.findFirst({
    where: eq(investors.id, base.keepInvestorId),
  });
  keepInvestorEmail = keepInvestorRow?.email ?? "keep@example.test";
  await db
    .update(investors)
    .set({ investorUserId: investorUser.id })
    .where(eq(investors.id, base.keepInvestorId));
  await db
    .update(borrowers)
    .set({ borrowerUserId: borrowerUser.id })
    .where(eq(borrowers.id, base.borrowerId));

  const [witnessRow] = await db
    .insert(witnesses)
    .values({
      userId: base.ownerId,
      witnessUserId: witnessUser.id,
      name: "Authz Witness",
      email: witnessUser.email,
    })
    .returning();
  await db.insert(loanWitnesses).values({
    loanId: base.loanId,
    witnessId: witnessRow.id,
  });

  const [group] = await db
    .insert(loanGroups)
    .values({ creatorUserId: base.ownerId, name: "Authz Group" })
    .returning();
  await db.insert(loanGroupMembers).values({
    groupId: group.id,
    userId: groupViewer.id,
  });
  await db.insert(loanGroupLoans).values({
    groupId: group.id,
    loanId: base.loanId,
    addedByUserId: base.ownerId,
  });

  const [debt] = await db
    .insert(debts)
    .values({
      userId: base.ownerId,
      investorId: base.keepInvestorId,
      name: "Authz bank loan",
      amount: "100000",
      date: new Date("2026-01-31T00:00:00.000Z"),
      interestRate: "5",
      interestInterval: "Monthly",
      durationMonths: 12,
    })
    .returning();
  const [debtPeriod] = await db
    .insert(debtInterestPeriods)
    .values({
      debtId: debt.id,
      periodNumber: 1,
      dueDate: new Date("2026-02-28T00:00:00.000Z"),
      expectedInstallment: "9000",
    })
    .returning();
  const [debtPayment] = await db
    .insert(debtReceivedPayments)
    .values({
      debtInterestPeriodId: debtPeriod.id,
      amount: "1000",
      receivedDate: new Date("2026-02-01T00:00:00.000Z"),
    })
    .returning();

  // A payment-free period so an owner mutation can succeed without touching
  // money that other assertions depend on.
  const [sparePeriod] = await db
    .insert(interestPeriods)
    .values({
      loanInvestorId: base.dropAllocationId,
      dueDate: new Date("2026-07-31T00:00:00.000Z"),
      interestRate: "5",
      interestType: "rate",
      status: "Pending",
    })
    .returning();

  fixture = {
    ...base,
    otherId: other.id,
    investorUserId: investorUser.id,
    borrowerUserId: borrowerUser.id,
    witnessUserId: witnessUser.id,
    groupViewerUserId: groupViewer.id,
    witnessRowId: witnessRow.id,
    groupId: group.id,
    debtId: debt.id,
    debtPeriodId: debtPeriod.id,
    debtPaymentId: debtPayment.id,
    sparePeriodId: sparePeriod.id,
  };

  actors = {
    owner: {
      id: base.ownerId,
      email: "owner-authz@example.test",
      role: "admin",
    },
    investor: investorUser,
    borrower: borrowerUser,
    witness: witnessUser,
    group: groupViewer,
    other,
  };

  // The health endpoint is keyed to the sitewide workspace owner email.
  const existingOwner = await db.query.users.findFirst({
    where: eq(users.email, WORKSPACE_OWNER_EMAIL),
  });
  if (existingOwner) {
    workspaceOwner = {
      id: existingOwner.id,
      email: existingOwner.email ?? WORKSPACE_OWNER_EMAIL,
      role: "admin",
    };
  } else {
    const inserted = await insertUser("workspace-owner", "admin");
    await db
      .update(users)
      .set({ email: WORKSPACE_OWNER_EMAIL })
      .where(eq(users.id, inserted.id));
    workspaceOwner = { ...inserted, email: WORKSPACE_OWNER_EMAIL };
  }
});

afterAll(async () => {
  if (!fixture) return;
  await db
    .delete(debtReceivedPayments)
    .where(eq(debtReceivedPayments.debtInterestPeriodId, fixture.debtPeriodId));
  await db
    .delete(debtInterestPeriods)
    .where(eq(debtInterestPeriods.debtId, fixture.debtId));
  await db.delete(debts).where(eq(debts.id, fixture.debtId));
  await db
    .delete(loanGroupLoans)
    .where(eq(loanGroupLoans.groupId, fixture.groupId));
  await db
    .delete(loanGroupMembers)
    .where(eq(loanGroupMembers.groupId, fixture.groupId));
  await db.delete(loanGroups).where(eq(loanGroups.id, fixture.groupId));
  await db
    .delete(loanWitnesses)
    .where(eq(loanWitnesses.witnessId, fixture.witnessRowId));
  await db.delete(witnesses).where(eq(witnesses.id, fixture.witnessRowId));
  await cleanupLoanFixture(fixture);
  await db
    .delete(users)
    .where(
      inArray(users.id, [
        fixture.otherId,
        fixture.investorUserId,
        fixture.borrowerUserId,
        fixture.witnessUserId,
        fixture.groupViewerUserId,
      ]),
    );
  // Saving a contact creates a party account for its email.
  await db.delete(users).where(eq(users.email, keepInvestorEmail));
});

function sessionEvent(
  actor: Actor | null,
  options: {
    params?: Record<string, string>;
    method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
    body?: unknown;
  } = {},
): RequestEvent {
  return {
    params: options.params ?? {},
    request: new Request("http://localhost/test", {
      method: options.method ?? "GET",
      headers: { "content-type": "application/json" },
      ...(options.body === undefined
        ? {}
        : { body: JSON.stringify(options.body) }),
    }),
    url: new URL("http://localhost/test"),
    locals: actor ? { session: { user: actor } } : {},
  } as unknown as RequestEvent;
}

const loanParams = () => ({ id: String(fixture.loanId) });
const paymentParams = () => ({ id: String(fixture.keepPaymentId) });
const periodParams = () => ({ id: String(fixture.keepPeriodId) });
const debtParams = () => ({ id: String(fixture.debtId) });
const debtPeriodParams = () => ({ id: String(fixture.debtPeriodId) });
const debtPaymentParams = () => ({ id: String(fixture.debtPaymentId) });

const loanEditBody = () => ({
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
    {
      id: fixture.dropAllocationId,
      investorId: fixture.dropInvestorId,
      amount: "50000",
      interestRate: "5",
      interestType: "rate",
      sentDate: "2026-01-15",
      isPaid: true,
      hasMultipleInterest: false,
      interestPeriods: [
        {
          id: fixture.sparePeriodId,
          dueDate: "2026-07-31",
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
});

const debtBody = () => ({
  investorId: fixture.keepInvestorId,
  name: "Authz bank loan",
  amount: "100000",
  date: "2026-01-31",
  interestRate: "5",
  interestInterval: "Monthly",
  durationMonths: 12,
  additionalFees: [],
  notes: null,
});

const loanRoutes = () => [
  {
    name: "PUT /api/loans/[id]",
    handler: routeHandler(putLoan),
    event: (actor: Actor | null) =>
      sessionEvent(actor, {
        params: loanParams(),
        method: "PUT",
        body: loanEditBody(),
      }),
  },
  {
    name: "DELETE /api/loans/[id]",
    handler: routeHandler(deleteLoan),
    event: (actor: Actor | null) =>
      sessionEvent(actor, { params: loanParams(), method: "DELETE" }),
  },
  {
    name: "POST /api/loans/[id]/received-payments",
    handler: routeHandler(createPayment),
    event: (actor: Actor | null) =>
      sessionEvent(actor, {
        params: loanParams(),
        method: "POST",
        body: {
          investorId: fixture.keepInvestorId,
          amount: "100",
          receivedDate: "2026-03-02",
          receiptImageUrl: "data:image/png;base64,AAAA",
        },
      }),
  },
  {
    name: "PATCH /api/received-payments/[id]",
    handler: routeHandler(patchPayment),
    event: (actor: Actor | null) =>
      sessionEvent(actor, {
        params: paymentParams(),
        method: "PATCH",
        body: { amount: "5000", receivedDate: "2026-03-01" },
      }),
  },
  {
    name: "DELETE /api/received-payments/[id]",
    handler: routeHandler(deletePayment),
    event: (actor: Actor | null) =>
      sessionEvent(actor, { params: paymentParams(), method: "DELETE" }),
  },
  {
    name: "PATCH /api/interest-periods/[id]",
    handler: routeHandler(patchPeriod),
    event: (actor: Actor | null) =>
      sessionEvent(actor, {
        params: periodParams(),
        method: "PATCH",
        body: { status: "Overdue" },
      }),
  },
  {
    name: "POST /api/interest-periods/[id]/consolidate-payment",
    handler: routeHandler(consolidatePeriod),
    event: (actor: Actor | null) =>
      sessionEvent(actor, {
        params: periodParams(),
        method: "POST",
        body: { amount: "5000", receivedDate: "2026-03-01" },
      }),
  },
];

const debtRoutes = () => [
  {
    name: "PUT /api/debts/[id]",
    handler: routeHandler(putDebt),
    event: (actor: Actor | null) =>
      sessionEvent(actor, {
        params: debtParams(),
        method: "PUT",
        body: debtBody(),
      }),
  },
  {
    name: "DELETE /api/debts/[id]",
    handler: routeHandler(deleteDebt),
    event: (actor: Actor | null) =>
      sessionEvent(actor, { params: debtParams(), method: "DELETE" }),
  },
  {
    name: "PATCH /api/debt-interest-periods/[id]",
    handler: routeHandler(patchDebtPeriod),
    event: (actor: Actor | null) =>
      sessionEvent(actor, {
        params: debtPeriodParams(),
        method: "PATCH",
        body: { status: "Pending" },
      }),
  },
  {
    name: "POST /api/debt-interest-periods/[id]/consolidate-payment",
    handler: routeHandler(consolidateDebtPeriod),
    event: (actor: Actor | null) =>
      sessionEvent(actor, {
        params: debtPeriodParams(),
        method: "POST",
        body: { amount: "1000", receivedDate: "2026-02-01" },
      }),
  },
  {
    name: "PATCH /api/debt-received-payments/[id]",
    handler: routeHandler(patchDebtPayment),
    event: (actor: Actor | null) =>
      sessionEvent(actor, {
        params: debtPaymentParams(),
        method: "PATCH",
        body: { amount: "1000", receivedDate: "2026-02-01" },
      }),
  },
  {
    name: "DELETE /api/debt-received-payments/[id]",
    handler: routeHandler(deleteDebtPayment),
    event: (actor: Actor | null) =>
      sessionEvent(actor, { params: debtPaymentParams(), method: "DELETE" }),
  },
];

const nonOwners = [
  "investor",
  "borrower",
  "witness",
  "group",
  "other",
] as const;

describe("authorization matrix: loan and payment routes", () => {
  for (const route of loanRoutes()) {
    it(`${route.name} rejects party accounts with 404`, async () => {
      for (const actor of nonOwners) {
        const response = await route.handler(route.event(actors[actor]));
        expect(response.status, `${route.name} as ${actor}`).toBe(404);
      }
    });

    it(`${route.name} rejects anonymous with 401`, async () => {
      const response = await route.handler(route.event(null));
      expect(response.status).toBe(401);
    });
  }
});

describe("authorization matrix: debt routes", () => {
  for (const route of debtRoutes()) {
    it(`${route.name} rejects party accounts with 404`, async () => {
      for (const actor of nonOwners) {
        const response = await route.handler(route.event(actors[actor]));
        expect(response.status, `${route.name} as ${actor}`).toBe(404);
      }
    });

    it(`${route.name} rejects anonymous with 401`, async () => {
      const response = await route.handler(route.event(null));
      expect(response.status).toBe(401);
    });
  }
});

describe("authorization matrix: read access", () => {
  it("loan detail is visible to every linked party and the group viewer", async () => {
    for (const actor of [
      "owner",
      "investor",
      "borrower",
      "witness",
      "group",
    ] as const) {
      const response = await routeHandler(getLoan)(
        sessionEvent(actors[actor], { params: loanParams() }),
      );
      expect(response.status, actor).toBe(200);
    }
  });

  it("unrelated user cannot see the loan or the debt", async () => {
    expect(
      (
        await routeHandler(getLoan)(
          sessionEvent(actors.other, { params: loanParams() }),
        )
      ).status,
    ).toBe(404);
    expect(
      (
        await routeHandler(getDebt)(
          sessionEvent(actors.other, { params: debtParams() }),
        )
      ).status,
    ).toBe(404);
  });

  it("debt investor can read but not write", async () => {
    const read = await routeHandler(getDebt)(
      sessionEvent(actors.investor, { params: debtParams() }),
    );
    expect(read.status).toBe(200);
    const write = await routeHandler(patchDebtPeriod)(
      sessionEvent(actors.investor, {
        params: debtPeriodParams(),
        method: "PATCH",
        body: { status: "Pending" },
      }),
    );
    expect(write.status).toBe(404);
  });

  it("loan list only returns the caller's loans", async () => {
    const ownerList = await routeHandler(listLoans)(sessionEvent(actors.owner));
    expect(ownerList.status).toBe(200);
    const ownerBody = (await ownerList.json()) as Array<{ id: number }>;
    expect(ownerBody.some((row) => row.id === fixture.loanId)).toBe(true);

    const otherList = await routeHandler(listLoans)(sessionEvent(actors.other));
    expect(otherList.status).toBe(200);
    const otherBody = (await otherList.json()) as Array<{ id: number }>;
    expect(otherBody.some((row) => row.id === fixture.loanId)).toBe(false);
  });
});

describe("authorization matrix: party write routes", () => {
  const partyRoutes = () => [
    {
      name: "PUT /api/investors/[id]",
      handler: routeHandler(putInvestor),
      params: () => ({ id: String(fixture.keepInvestorId) }),
      body: () => ({
        name: "Authz Investor Renamed",
        email: keepInvestorEmail,
      }),
    },
    {
      name: "PUT /api/borrowers/[id]",
      handler: routeHandler(putBorrower),
      params: () => ({ id: String(fixture.borrowerId) }),
      body: () => ({ name: "Authz Borrower Renamed" }),
    },
    {
      name: "PUT /api/witnesses/[id]",
      handler: routeHandler(putWitness),
      params: () => ({ id: String(fixture.witnessRowId) }),
      body: () => ({ name: "Authz Witness Renamed" }),
    },
  ];

  for (const route of partyRoutes()) {
    it(`${route.name} rejects non-owners with 404`, async () => {
      for (const actor of nonOwners) {
        const response = await route.handler(
          sessionEvent(actors[actor], {
            params: route.params(),
            method: "PUT",
            body: route.body(),
          }),
        );
        expect(response.status, `${route.name} as ${actor}`).toBe(404);
      }
    });

    it(`${route.name} allows the owner`, async () => {
      const response = await route.handler(
        sessionEvent(actors.owner, {
          params: route.params(),
          method: "PUT",
          body: route.body(),
        }),
      );
      expect(response.status).toBe(200);
    });
  }
});

describe("authorization matrix: owner happy paths", () => {
  it("owner can edit a loan", async () => {
    const response = await routeHandler(putLoan)(
      sessionEvent(actors.owner, {
        params: loanParams(),
        method: "PUT",
        body: loanEditBody(),
      }),
    );
    expect(response.status).toBe(200);
  });

  it("owner can mark a payment-free loan period overdue", async () => {
    const response = await routeHandler(patchPeriod)(
      sessionEvent(actors.owner, {
        params: { id: String(fixture.sparePeriodId) },
        method: "PATCH",
        body: { status: "Overdue" },
      }),
    );
    expect(response.status).toBe(200);
  });

  it("owner can update and delete a received payment", async () => {
    const patch = await routeHandler(patchPayment)(
      sessionEvent(actors.owner, {
        params: paymentParams(),
        method: "PATCH",
        body: { amount: "5000", receivedDate: "2026-03-01" },
      }),
    );
    expect(patch.status).toBe(200);

    const remove = await routeHandler(deletePayment)(
      sessionEvent(actors.owner, {
        params: paymentParams(),
        method: "DELETE",
      }),
    );
    expect(remove.status).toBe(200);
  });

  it("owner can update and delete a debt payment", async () => {
    const patch = await routeHandler(patchDebtPayment)(
      sessionEvent(actors.owner, {
        params: debtPaymentParams(),
        method: "PATCH",
        body: { amount: "1000", receivedDate: "2026-02-01" },
      }),
    );
    expect(patch.status).toBe(200);

    const remove = await routeHandler(deleteDebtPayment)(
      sessionEvent(actors.owner, {
        params: debtPaymentParams(),
        method: "DELETE",
      }),
    );
    expect(remove.status).toBe(200);
  });
});

describe("authorization matrix: admin endpoints", () => {
  it("E2E cleanup is disabled unless the E2E secret is configured", async () => {
    const response = await routeHandler(e2eCleanup)(
      sessionEvent(actors.owner, {
        method: "POST",
        body: { emails: ["nobody@example.test"] },
      }),
    );
    // 404 when the secret is unset (CI), 401 when it is set but the header
    // is missing (local .env).
    expect([401, 404]).toContain(response.status);
  });

  it("money health is workspace-owner only", async () => {
    const owner = await routeHandler(moneyHealth)(sessionEvent(workspaceOwner));
    expect(owner.status).toBe(200);

    const nonOwner = await routeHandler(moneyHealth)(
      sessionEvent(actors.owner),
    );
    expect(nonOwner.status).toBe(403);

    const anonymous = await routeHandler(moneyHealth)(sessionEvent(null));
    expect(anonymous.status).toBe(401);
  });
});
