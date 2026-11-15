import { describe, expect, it } from "vitest";
import { collectStatusDrift, type StatusDriftLoan } from "./status-drift";

/**
 * The same rule feeds the status sweep and the health report. These cases
 * cover the false positives the old SQL checks produced: unlinked money,
 * interest based on total investor capital, and overdue principal with no
 * overdue period.
 */

const pastDue = "2020-06-01";

function loan(overrides: Partial<StatusDriftLoan> = {}): StatusDriftLoan {
  return {
    id: 1,
    dueDate: "2020-12-31",
    status: "Overdue",
    statusOverride: null,
    loanInvestors: [
      {
        id: 10,
        investorId: 1,
        investor: { id: 1, name: "Lender" },
        amount: "100000",
        interestRate: "5",
        interestType: "rate",
        sentDate: "2020-01-01",
        isPaid: true,
        hasMultipleInterest: true,
        interestPeriods: [
          {
            id: 101,
            dueDate: pastDue,
            interestRate: "5",
            interestType: "rate",
            status: "Overdue",
          },
        ],
        receivedPayments: [],
      },
    ],
    ...overrides,
  };
}

describe("collectStatusDrift", () => {
  it("flags a completed period with no payment", () => {
    const drift = collectStatusDrift([
      loan({
        loanInvestors: [
          {
            ...loan().loanInvestors[0],
            interestPeriods: [
              {
                id: 101,
                dueDate: pastDue,
                interestRate: "5",
                interestType: "rate",
                status: "Completed",
              },
            ],
          },
        ],
      }),
    ]);
    expect(drift.periods).toEqual([
      {
        periodId: 101,
        loanId: 1,
        stored: "Completed",
        derived: "Overdue",
      },
    ]);
    expect(drift.loans).toEqual([]);
  });

  it("accepts a completed period covered by a linked payment", () => {
    const drift = collectStatusDrift([
      loan({
        loanInvestors: [
          {
            ...loan().loanInvestors[0],
            interestPeriods: [
              {
                id: 101,
                dueDate: pastDue,
                interestRate: "5",
                interestType: "rate",
                status: "Completed",
              },
            ],
            receivedPayments: [
              { id: 1, interestPeriodId: 101, amount: "5000" },
            ],
          },
        ],
      }),
    ]);
    expect(drift.periods).toEqual([]);
  });

  it("accepts a completed period covered by unlinked money", () => {
    const drift = collectStatusDrift([
      loan({
        loanInvestors: [
          {
            ...loan().loanInvestors[0],
            interestPeriods: [
              {
                id: 101,
                dueDate: pastDue,
                interestRate: "5",
                interestType: "rate",
                status: "Completed",
              },
            ],
            receivedPayments: [
              { id: 1, interestPeriodId: null, amount: "5000" },
            ],
          },
        ],
      }),
    ]);
    expect(drift.periods).toEqual([]);
  });

  it("keeps Incomplete when the payment only covers the old allocation base", () => {
    const drift = collectStatusDrift([
      loan({
        loanInvestors: [
          {
            ...loan().loanInvestors[0],
            amount: "400000",
            interestPeriods: [
              {
                id: 101,
                dueDate: pastDue,
                interestRate: "10",
                interestType: "rate",
                status: "Incomplete",
              },
            ],
            receivedPayments: [
              { id: 1, interestPeriodId: 101, amount: "30000" },
            ],
          },
        ],
      }),
    ]);
    // The allocation amount is 400000, so 10% is 40000; 30000 is short.
    expect(drift.periods).toEqual([]);
  });

  it("flags a period paid above its expected interest", () => {
    const drift = collectStatusDrift([
      loan({
        loanInvestors: [
          {
            ...loan().loanInvestors[0],
            interestPeriods: [
              {
                id: 101,
                dueDate: pastDue,
                interestRate: "5",
                interestType: "rate",
                status: "Incomplete",
              },
            ],
            receivedPayments: [
              { id: 1, interestPeriodId: 101, amount: "5000" },
            ],
          },
        ],
      }),
    ]);
    expect(drift.periods).toEqual([
      {
        periodId: 101,
        loanId: 1,
        stored: "Incomplete",
        derived: "Completed",
      },
    ]);
  });

  it("flags a stale loan status", () => {
    const drift = collectStatusDrift([
      loan({
        status: "Completed",
        loanInvestors: [
          {
            ...loan().loanInvestors[0],
            interestRate: "0",
            interestPeriods: [
              {
                id: 101,
                dueDate: "2999-06-01",
                interestRate: "0",
                interestType: "rate",
                status: "Pending",
              },
            ],
          },
        ],
      }),
    ]);
    expect(drift.loans).toEqual([
      { loanId: 1, stored: "Completed", derived: "Overdue" },
    ]);
  });

  it("keeps an overdue loan with unpaid principal and no overdue period", () => {
    const drift = collectStatusDrift([
      loan({
        loanInvestors: [
          {
            ...loan().loanInvestors[0],
            interestRate: "0",
            interestPeriods: [
              {
                id: 101,
                dueDate: "2020-06-01",
                interestRate: "0",
                interestType: "rate",
                status: "Overdue",
              },
            ],
          },
        ],
      }),
    ]);
    expect(drift.periods).toEqual([]);
    expect(drift.loans).toEqual([]);
  });

  it("honors a manual completed override", () => {
    const drift = collectStatusDrift([
      loan({
        status: "Completed",
        statusOverride: "Completed",
        loanInvestors: [
          {
            ...loan().loanInvestors[0],
            interestRate: "0",
            interestPeriods: [],
          },
        ],
      }),
    ]);
    expect(drift.loans).toEqual([]);
  });
});
