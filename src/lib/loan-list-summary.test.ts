import { describe, expect, it } from "vitest";
import {
  computeCurrentCapital,
  computeInvestorPortfolioCapitalStats,
  computeLoanListSummaryStats,
  computeNetCapitalInvested,
  computePartyCommissionStats,
  loanHasPartyCommission,
  computePeakConcurrentInvestorPrincipal,
  computePeakConcurrentPrincipal,
  computePortfolioCapitalStats,
} from "$lib/loan-list-summary";
import { buildLoanLedger } from "$lib/money/ledger";
import type { LoanWithInvestors } from "$lib/types";

function loanFixture(input: {
  status: LoanWithInvestors["status"];
  amount: string;
  rate?: string;
  sentDate: string;
  dueDate: string;
  updatedAt?: string;
  profitType?: "rate" | "fixed";
  profitValue?: string;
  receivedAmount?: string;
}): LoanWithInvestors {
  return {
    status: input.status,
    dueDate: input.dueDate,
    createdAt: new Date(input.sentDate),
    updatedAt: new Date(input.updatedAt ?? input.dueDate),
    profitType: input.profitType ?? "rate",
    profitValue: input.profitValue ?? "0",
    loanInvestors: [
      {
        amount: input.amount,
        sentDate: input.sentDate,
        interestRate: input.rate ?? "10",
        interestType: "rate",
        hasMultipleInterest: false,
        investorId: 1,
        investor: { id: 1 },
        isPaid: true,
        profitType: "rate",
        profitValue: "0",
        receivedPayments: input.receivedAmount
          ? [
              {
                id: 1,
                loanInvestorId: 1,
                amount: input.receivedAmount,
                receivedDate: new Date(input.sentDate),
              },
            ]
          : [],
      },
    ],
  } as unknown as LoanWithInvestors;
}

describe("computePeakConcurrentPrincipal", () => {
  it("counts reused capital once when loan periods do not overlap", () => {
    const peak = computePeakConcurrentPrincipal(
      [
        loanFixture({
          status: "Completed",
          amount: "100000",
          sentDate: "2026-09-01",
          dueDate: "2026-09-10",
        }),
        loanFixture({
          status: "Completed",
          amount: "100000",
          sentDate: "2026-09-11",
          dueDate: "2026-09-20",
        }),
      ],
      "2026-09-01",
      "2026-09-30",
    );

    expect(peak).toBe(100000);
  });

  it("counts overlapping loan periods as separate capital", () => {
    const peak = computePeakConcurrentPrincipal(
      [
        loanFixture({
          status: "Completed",
          amount: "100000",
          sentDate: "2026-09-01",
          dueDate: "2026-09-10",
        }),
        loanFixture({
          status: "Completed",
          amount: "100000",
          sentDate: "2026-09-05",
          dueDate: "2026-09-15",
        }),
      ],
      "2026-09-01",
      "2026-09-30",
    );

    expect(peak).toBe(200000);
  });
});

describe("computeInvestorPortfolioCapitalStats", () => {
  it("uses multiple interest periods on investor allocations", () => {
    const stats = computeInvestorPortfolioCapitalStats([
      {
        loanId: 1,
        amount: "100000",
        sentDate: "2026-01-01",
        isPaid: true,
        interestRate: "5",
        interestType: "rate",
        hasMultipleInterest: true,
        investorId: 1,
        investor: { id: 1 },
        interestPeriods: [
          { interestRate: "10", interestType: "rate" },
          { interestRate: "10", interestType: "rate" },
        ],
        loan: {
          status: "Fully Funded",
          dueDate: "2026-12-01",
          updatedAt: new Date("2026-01-01"),
        },
      },
    ] as never);

    expect(stats.interestEstimate).toBe(20000);
  });

  it("undercounts when multiple-interest rows omit interestPeriods", () => {
    const stats = computeInvestorPortfolioCapitalStats([
      {
        loanId: 1,
        amount: "100000",
        sentDate: "2026-01-01",
        isPaid: true,
        interestRate: "5",
        interestType: "rate",
        hasMultipleInterest: true,
        investorId: 1,
        investor: { id: 1 },
        loan: {
          status: "Fully Funded",
          dueDate: "2026-12-01",
          updatedAt: new Date("2026-01-01"),
        },
      },
    ] as never);

    expect(stats.interestEstimate).toBe(5000);
  });
});

describe("computePeakConcurrentInvestorPrincipal", () => {
  it("dedupes the same investor capital across sequential allocations", () => {
    const peak = computePeakConcurrentInvestorPrincipal([
      {
        loanId: 1,
        amount: "100000",
        sentDate: "2026-09-01",
        isPaid: true,
        interestRate: "10",
        interestType: "rate",
        hasMultipleInterest: false,
        investorId: 1,
        loan: {
          status: "Completed",
          dueDate: "2026-09-10",
          updatedAt: new Date("2026-09-10"),
        },
      },
      {
        loanId: 2,
        amount: "100000",
        sentDate: "2026-09-11",
        isPaid: true,
        interestRate: "10",
        interestType: "rate",
        hasMultipleInterest: false,
        investorId: 1,
        loan: {
          status: "Fully Funded",
          dueDate: "2026-09-20",
          updatedAt: new Date("2026-09-11"),
        },
      },
    ] as never);

    expect(peak).toBe(100000);
  });
});

describe("computePortfolioCapitalStats", () => {
  it("computes all-time dashboard capital splits without double-counting reuse", () => {
    const stats = computePortfolioCapitalStats([
      loanFixture({
        status: "Completed",
        amount: "100000",
        sentDate: "2025-01-01",
        dueDate: "2025-01-10",
        receivedAmount: "10000",
      }),
      loanFixture({
        status: "Completed",
        amount: "100000",
        sentDate: "2025-01-11",
        dueDate: "2025-01-20",
        receivedAmount: "10000",
      }),
      loanFixture({
        status: "Fully Funded",
        amount: "150000",
        sentDate: "2026-09-01",
        dueDate: "2026-09-30",
      }),
    ]);

    expect(stats.totalPrincipal).toBe(150000);
    expect(stats.activePrincipal).toBe(150000);
    expect(stats.completedPrincipal).toBe(100000);
    expect(stats.interestEstimate).toBe(35000);
    expect(stats.interestEarned).toBe(20000);
    expect(stats.totalInterestScheduled).toBe(35000);
  });
});

describe("computeNetCapitalInvested", () => {
  it("counts sequential reuse as one net deployment over all time", () => {
    const net = computeNetCapitalInvested(
      [
        loanFixture({
          status: "Completed",
          amount: "100000",
          rate: "10",
          sentDate: "2026-08-01",
          dueDate: "2026-08-10",
          updatedAt: "2026-08-10",
        }),
        loanFixture({
          status: "Fully Funded",
          amount: "100000",
          sentDate: "2026-08-11",
          dueDate: "2026-08-20",
        }),
      ],
      null,
      null,
    );

    expect(net).toBe(100000);
  });

  it("treats principal plus interest returned as reinvestment before counting net new", () => {
    const net = computeNetCapitalInvested(
      [
        loanFixture({
          status: "Completed",
          amount: "100000",
          rate: "10",
          sentDate: "2026-08-01",
          dueDate: "2026-08-10",
          updatedAt: "2026-08-10",
        }),
        loanFixture({
          status: "Fully Funded",
          amount: "110000",
          sentDate: "2026-08-11",
          dueDate: "2026-08-20",
        }),
      ],
      null,
      null,
    );

    expect(net).toBe(100000);
  });

  it("only sums net new fundings whose sent date falls in the range", () => {
    const net = computeNetCapitalInvested(
      [
        loanFixture({
          status: "Completed",
          amount: "100000",
          rate: "10",
          sentDate: "2026-07-01",
          dueDate: "2026-07-10",
          updatedAt: "2026-07-10",
        }),
        loanFixture({
          status: "Fully Funded",
          amount: "160000",
          sentDate: "2026-09-05",
          dueDate: "2026-09-30",
        }),
      ],
      "2026-09-01",
      "2026-09-30",
    );

    expect(net).toBe(50000);
  });
});

describe("computeCurrentCapital", () => {
  it("sums paid principal on open loans only", () => {
    const current = computeCurrentCapital([
      loanFixture({
        status: "Fully Funded",
        amount: "150000",
        sentDate: "2026-09-01",
        dueDate: "2026-09-30",
      }),
      loanFixture({
        status: "Completed",
        amount: "100000",
        sentDate: "2026-08-01",
        dueDate: "2026-08-31",
      }),
    ]);

    expect(current).toBe(150000);
  });
});

describe("computeLoanListSummaryStats", () => {
  it("keeps earned interest and completed count when list payload includes lean payments", () => {
    // Mirrors /loans listRelations after finalizeLoansForViewer: status comes
    // from the ledger, which needs period ids + receivedPayments (no receipts).
    const listLoan = {
      id: 1,
      loanName: "list-shaped",
      status: "Fully Funded",
      statusOverride: null,
      dueDate: new Date("2026-10-20"),
      updatedAt: new Date("2026-10-20"),
      loanInvestors: [
        {
          id: 1,
          investorId: 1,
          amount: "100000",
          interestRate: "10",
          interestType: "Percentage",
          sentDate: new Date("2026-09-01"),
          isPaid: true,
          hasMultipleInterest: true,
          interestPeriods: [
            {
              id: 101,
              interestRate: "10",
              interestType: "Percentage",
              dueDate: new Date("2026-10-15"),
              deletedAt: null,
            },
          ],
          receivedPayments: [
            {
              id: 1,
              loanInvestorId: 1,
              interestPeriodId: 101,
              amount: "10000",
              receivedDate: new Date("2026-10-10"),
              deletedAt: null,
            },
            {
              id: 2,
              loanInvestorId: 1,
              interestPeriodId: null,
              amount: "100000",
              receivedDate: new Date("2026-10-18"),
              deletedAt: null,
            },
          ],
        },
      ],
    } as unknown as LoanWithInvestors;

    const withoutPayments = {
      ...listLoan,
      loanInvestors: listLoan.loanInvestors.map((row) => ({
        ...row,
        receivedPayments: undefined,
      })),
    } as unknown as LoanWithInvestors;

    const derived = {
      ...listLoan,
      status: buildLoanLedger(listLoan).status,
    } as LoanWithInvestors;
    const broken = {
      ...withoutPayments,
      status: buildLoanLedger(withoutPayments).status,
    } as LoanWithInvestors;

    const ok = computeLoanListSummaryStats([derived]);
    const zeroed = computeLoanListSummaryStats([broken]);

    expect(ok.interestEarned).toBe(10000);
    expect(ok.completedCount).toBe(1);
    expect(zeroed.interestEarned).toBe(0);
    expect(zeroed.completedCount).toBe(0);
  });

  it("totals interest on all loans in range and splits earned on completed", () => {
    const stats = computeLoanListSummaryStats(
      [
        loanFixture({
          status: "Fully Funded",
          amount: "100000",
          sentDate: "2026-09-01",
          dueDate: "2026-09-10",
        }),
        loanFixture({
          status: "Overdue",
          amount: "50000",
          sentDate: "2026-09-11",
          dueDate: "2026-09-20",
        }),
        loanFixture({
          status: "Completed",
          amount: "200000",
          sentDate: "2026-08-01",
          dueDate: "2026-08-31",
          receivedAmount: "20000",
        }),
      ],
      "2026-09-01",
      "2026-09-30",
    );

    expect(stats.currentCapital).toBe(150000);
    expect(stats.totalCapitalInvested).toBe(0);
    expect(stats.interestEstimate).toBe(35000);
    expect(stats.interestEarned).toBe(20000);
    expect(stats.completedCount).toBe(1);
    expect(stats.totalLoanCount).toBe(3);
  });

  it("uses capital history for reinvestment while current capital stays on visible loans", () => {
    const completed = loanFixture({
      status: "Completed",
      amount: "100000",
      rate: "10",
      sentDate: "2026-08-01",
      dueDate: "2026-08-10",
      updatedAt: "2026-08-10",
    });
    const open = loanFixture({
      status: "Fully Funded",
      amount: "100000",
      sentDate: "2026-09-05",
      dueDate: "2026-09-30",
    });

    const stats = computeLoanListSummaryStats(
      [open],
      "2026-09-01",
      "2026-09-30",
      [completed, open],
    );

    expect(stats.currentCapital).toBe(100000);
    expect(stats.totalCapitalInvested).toBe(0);
    expect(stats.totalLoanCount).toBe(1);
  });
});

describe("computePartyCommissionStats", () => {
  it("uses the private myCommission field for the signed-in user", () => {
    const loan = loanFixture({
      status: "Fully Funded",
      amount: "100000",
      sentDate: "2026-09-01",
      dueDate: "2026-09-30",
      profitType: "rate",
      profitValue: "0",
    });
    loan.myCommission = { profitType: "rate", profitValue: "10" };

    const stats = computePartyCommissionStats([loan]);

    expect(stats.profitEstimate).toBe(10000);
    expect(stats.totalLoanCount).toBe(1);
  });

  it("excludes loans without commission from counts", () => {
    const withCommission = loanFixture({
      status: "Fully Funded",
      amount: "100000",
      sentDate: "2026-09-01",
      dueDate: "2026-09-30",
      profitType: "rate",
      profitValue: "0",
    });
    withCommission.myCommission = { profitType: "rate", profitValue: "10" };

    const withoutCommission = loanFixture({
      status: "Completed",
      amount: "50000",
      sentDate: "2026-08-01",
      dueDate: "2026-08-31",
      profitType: "rate",
      profitValue: "0",
    });
    withoutCommission.myCommission = null;

    expect(loanHasPartyCommission(withCommission)).toBe(true);
    expect(loanHasPartyCommission(withoutCommission)).toBe(false);

    const stats = computePartyCommissionStats([
      withCommission,
      withoutCommission,
    ]);
    expect(stats.totalLoanCount).toBe(1);
    expect(stats.completedCount).toBe(0);
    expect(stats.profitEstimate).toBe(10000);
  });
});
