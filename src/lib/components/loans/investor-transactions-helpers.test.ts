import { describe, expect, it } from "vitest";
import {
  computeInvestorMetrics,
  type InvestorWithTransactions,
} from "./investor-transactions-helpers";

function item(
  payments: InvestorWithTransactions["receivedPayments"],
): InvestorWithTransactions {
  return {
    investor: { id: 1, name: "Lender" },
    hasMultipleInterest: true,
    transactions: [
      {
        id: 10,
        amount: "100000",
        interestRate: "5",
        interestType: "rate",
        sentDate: "2026-01-01",
        isPaid: true,
      },
    ],
    interestPeriods: [
      {
        id: 101,
        dueDate: "2026-02-01",
        interestRate: "5",
        interestType: "rate",
        status: "Pending",
      },
      {
        id: 102,
        dueDate: "2026-03-01",
        interestRate: "5",
        interestType: "rate",
        status: "Pending",
      },
    ],
    receivedPayments: payments,
  };
}

describe("computeInvestorMetrics unlinked allocation", () => {
  it("maps unlinked money to the oldest open period", () => {
    const metrics = computeInvestorMetrics(
      item([
        {
          id: 201,
          amount: "5000",
          receivedDate: "2026-02-01",
          interestPeriodId: null,
          receipts: [],
        },
      ]),
      100000,
    );

    expect(metrics.unlinkedPayments).toHaveLength(1);
    expect(metrics.periodPaidById.get(101)).toBeCloseTo(5000, 2);
    expect(metrics.periodPaidById.get(102)).toBeCloseTo(0, 2);
  });

  it("spreads partial unlinked money across periods", () => {
    const metrics = computeInvestorMetrics(
      item([
        {
          id: 201,
          amount: "3000",
          receivedDate: "2026-02-01",
          interestPeriodId: null,
          receipts: [],
        },
      ]),
      100000,
    );

    expect(metrics.periodPaidById.get(101)).toBeCloseTo(3000, 2);
    expect(metrics.periodPaidById.get(102)).toBeCloseTo(0, 2);
  });

  it("keeps linked money on its period and leaves unlinked empty", () => {
    const metrics = computeInvestorMetrics(
      item([
        {
          id: 201,
          amount: "5000",
          receivedDate: "2026-03-01",
          interestPeriodId: 102,
          receipts: [],
        },
      ]),
      100000,
    );

    expect(metrics.unlinkedPayments).toHaveLength(0);
    expect(metrics.periodPaidById.get(101)).toBeCloseTo(0, 2);
    expect(metrics.periodPaidById.get(102)).toBeCloseTo(5000, 2);
  });

  it("allocates unlinked money before later linked periods are considered", () => {
    const metrics = computeInvestorMetrics(
      item([
        {
          id: 201,
          amount: "5000",
          receivedDate: "2026-02-01",
          interestPeriodId: null,
          receipts: [],
        },
        {
          id: 202,
          amount: "5000",
          receivedDate: "2026-03-01",
          interestPeriodId: 102,
          receipts: [],
        },
      ]),
      100000,
    );

    expect(metrics.periodPaidById.get(101)).toBeCloseTo(5000, 2);
    expect(metrics.periodPaidById.get(102)).toBeCloseTo(5000, 2);
    expect(metrics.unlinkedPayments).toHaveLength(1);
  });
});
