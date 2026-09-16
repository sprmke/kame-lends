import { describe, expect, it } from "vitest";
import type { LoanWithInvestors } from "$lib/types";
import {
  allocationsForInvestorUser,
  buildGroupPeopleRows,
  buildGroupPersonInvestorView,
  compactStatsForPersonRole,
  investorFromGroupLoans,
  loansForPersonRole,
} from "./group-people";

function loan(input: {
  id: number;
  name: string;
  userId?: string;
  borrowerUserId?: string;
  investorUserId?: string;
  investorId?: number;
  witnessUserId?: string;
  amount?: string;
  status?: LoanWithInvestors["status"];
  dueDate?: string;
}): LoanWithInvestors {
  return {
    id: input.id,
    loanName: input.name,
    userId: input.userId,
    status: input.status ?? "Fully Funded",
    dueDate: input.dueDate ?? "2026-12-01",
    createdAt: new Date("2026-01-01"),
    updatedAt: new Date("2026-01-01"),
    profitType: "rate",
    profitValue: "0",
    borrower: input.borrowerUserId
      ? { borrowerUserId: input.borrowerUserId }
      : null,
    loanInvestors: input.investorUserId
      ? [
          {
            amount: input.amount ?? "100000",
            sentDate: "2026-01-01",
            interestRate: "10",
            interestType: "rate",
            hasMultipleInterest: false,
            investorId: input.investorId ?? 7,
            isPaid: true,
            investor: {
              id: input.investorId ?? 7,
              name: "Inv",
              email: "inv@example.com",
              investorUserId: input.investorUserId,
            },
          },
        ]
      : [],
    loanWitnesses: input.witnessUserId
      ? [{ witness: { witnessUserId: input.witnessUserId } }]
      : [],
  } as unknown as LoanWithInvestors;
}

const loans = [
  loan({
    id: 1,
    name: "Owned",
    userId: "owner-1",
    borrowerUserId: "bor-1",
    investorUserId: "inv-1",
    investorId: 7,
    amount: "100000",
  }),
  loan({
    id: 2,
    name: "Other",
    userId: "owner-2",
    borrowerUserId: "bor-2",
    investorUserId: "inv-2",
    investorId: 8,
    amount: "50000",
  }),
];

describe("loansForPersonRole", () => {
  it("scopes loans to the section role", () => {
    expect(
      loansForPersonRole("owner-1", loans, "owner").map((row) => row.id),
    ).toEqual([1]);
    expect(
      loansForPersonRole("inv-1", loans, "investor").map((row) => row.id),
    ).toEqual([1]);
    expect(
      loansForPersonRole("bor-1", loans, "borrower").map((row) => row.id),
    ).toEqual([1]);
    expect(loansForPersonRole("owner-1", loans, "investor")).toEqual([]);
  });
});

describe("investorFromGroupLoans", () => {
  it("returns the investor CRM row linked to the user", () => {
    const investor = investorFromGroupLoans("inv-1", loans);
    expect(investor?.id).toBe(7);
    expect(investor?.investorUserId).toBe("inv-1");
  });
});

describe("compactStatsForPersonRole", () => {
  it("uses investor allocations in the investor section", () => {
    const stats = compactStatsForPersonRole("inv-1", loans, "investor");
    expect(stats.amountLabel).toBe("Capital");
    expect(stats.amount).toBe(100000);
    expect(stats.loanCount).toBe(1);
  });

  it("counts unpaid allocation principal", () => {
    const unpaid = loan({
      id: 9,
      name: "Unpaid",
      userId: "owner-1",
      investorUserId: "inv-1",
      amount: "2500",
    });
    unpaid.loanInvestors = unpaid.loanInvestors?.map((row) => ({
      ...row,
      isPaid: false,
    }));
    const stats = compactStatsForPersonRole("inv-1", [unpaid], "investor");
    expect(stats.amount).toBe(2500);
  });

  it("uses full loan principal for owner and borrower sections", () => {
    const owner = compactStatsForPersonRole("owner-1", loans, "owner");
    expect(owner.amountLabel).toBe("Principal");
    expect(owner.amount).toBe(100000);
    const borrower = compactStatsForPersonRole("bor-1", loans, "borrower");
    expect(borrower.amount).toBe(100000);
  });
});

describe("buildGroupPersonInvestorView", () => {
  it("scopes to the investor CRM row for investors", () => {
    const view = buildGroupPersonInvestorView(
      { userId: "inv-1", name: "Inv" },
      loans,
      "investor",
    );
    expect(view.scopeToInvestor).toBe(true);
    expect(view.investor.id).toBe(7);
  });

  it("does not scope owner views to an investor row", () => {
    const view = buildGroupPersonInvestorView(
      { userId: "owner-1", name: "Owner" },
      loans,
      "owner",
    );
    expect(view.scopeToInvestor).toBe(false);
    expect(view.investor.id).toBe(0);
  });
});

describe("allocationsForInvestorUser", () => {
  it("keeps only that user's allocations", () => {
    const mixed = loan({
      id: 3,
      name: "Split",
      userId: "owner-1",
      investorUserId: "inv-1",
      amount: "40000",
    });
    mixed.loanInvestors = [
      ...(mixed.loanInvestors ?? []),
      {
        amount: "60000",
        sentDate: "2026-01-01",
        interestRate: "10",
        interestType: "rate",
        hasMultipleInterest: false,
        investorId: 9,
        isPaid: true,
        investor: {
          id: 9,
          name: "Other",
          email: "o@example.com",
          investorUserId: "inv-2",
        },
      } as never,
    ];
    const rows = allocationsForInvestorUser("inv-1", [mixed]);
    expect(rows).toHaveLength(1);
    expect(rows[0]?.amount).toBe("40000");
  });
});

describe("buildGroupPeopleRows", () => {
  it("adds owner role and strips email unless requested", () => {
    const rows = buildGroupPeopleRows(
      [
        {
          userId: "owner-1",
          partyRoles: ["owner"],
          user: { id: "owner-1", name: "Pat", email: "p@x.com" },
        },
      ],
      loans,
      "owner-1",
    );
    expect(rows[0]?.roles).toContain("owner");
    expect(rows[0]?.email).toBeNull();
    expect(rows[0]?.loanCount).toBe(1);
  });
});
