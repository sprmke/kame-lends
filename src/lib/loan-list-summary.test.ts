import { describe, expect, it } from "vitest";
import {
  computeInvestorPortfolioCapitalStats,
  computeLoanListSummaryStats,
  computePeakConcurrentInvestorPrincipal,
  computePeakConcurrentPrincipal,
  computePortfolioCapitalStats,
} from "$lib/loan-list-summary";
import type { LoanWithInvestors } from "$lib/types";

function loanFixture(input: {
  status: LoanWithInvestors["status"];
  amount: string;
  rate?: string;
  sentDate: string;
  dueDate: string;
  updatedAt?: string;
}): LoanWithInvestors {
  return {
    status: input.status,
    dueDate: input.dueDate,
    createdAt: new Date(input.sentDate),
    updatedAt: new Date(input.updatedAt ?? input.dueDate),
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
      },
    ],
  } as LoanWithInvestors;
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
      }),
      loanFixture({
        status: "Completed",
        amount: "100000",
        sentDate: "2025-01-11",
        dueDate: "2025-01-20",
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
    expect(stats.interestEstimate).toBe(15000);
    expect(stats.interestEarned).toBe(20000);
    expect(stats.totalInterestScheduled).toBe(35000);
  });
});

describe("computeLoanListSummaryStats", () => {
  it("splits open vs completed interest and dedupes open principal", () => {
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
        }),
      ],
      "2026-09-01",
      "2026-09-30",
    );

    expect(stats.totalPrincipal).toBe(100000);
    expect(stats.interestEstimate).toBe(15000);
    expect(stats.interestEarned).toBe(20000);
    expect(stats.completedCount).toBe(1);
    expect(stats.totalLoanCount).toBe(3);
  });

  it("includes completed loans when they overlap open loans in the same range", () => {
    const stats = computeLoanListSummaryStats(
      [
        loanFixture({
          status: "Completed",
          amount: "100000",
          sentDate: "2026-09-01",
          dueDate: "2026-09-15",
        }),
        loanFixture({
          status: "Fully Funded",
          amount: "100000",
          sentDate: "2026-09-05",
          dueDate: "2026-09-30",
        }),
      ],
      "2026-09-01",
      "2026-09-30",
    );

    expect(stats.totalPrincipal).toBe(200000);
  });

  it("shows deduplicated capital when every loan in range is completed", () => {
    const stats = computeLoanListSummaryStats(
      [
        loanFixture({
          status: "Completed",
          amount: "100000",
          sentDate: "2026-08-01",
          dueDate: "2026-08-10",
        }),
        loanFixture({
          status: "Completed",
          amount: "100000",
          sentDate: "2026-08-11",
          dueDate: "2026-08-20",
        }),
      ],
      "2026-08-01",
      "2026-08-31",
    );

    expect(stats.totalPrincipal).toBe(100000);
    expect(stats.interestEstimate).toBe(0);
    expect(stats.interestEarned).toBe(20000);
    expect(stats.completedCount).toBe(2);
    expect(stats.totalLoanCount).toBe(2);
  });
});
