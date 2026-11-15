import { describe, expect, it } from "vitest";
import { buildLoanLedger, sumLedgers, type LedgerLoanInput } from "./ledger";

const TODAY = "2026-02-01";

function loan(overrides: Partial<LedgerLoanInput> = {}): LedgerLoanInput {
  return {
    dueDate: "2026-06-30",
    loanInvestors: [
      {
        id: 1,
        investor: { id: 7, name: "Ana" },
        amount: "100000",
        interestRate: "3",
        interestType: "rate",
        sentDate: "2026-01-01",
        isPaid: true,
        receivedPayments: [],
        ...overrides.loanInvestors?.[0],
      },
    ],
    ...overrides,
  };
}

describe("buildLoanLedger", () => {
  it("computes single interest", () => {
    const ledger = buildLoanLedger(loan(), { today: TODAY });
    expect(ledger.principalC).toBe(10_000_000);
    expect(ledger.interestExpectedC).toBe(300_000);
    expect(ledger.dueC).toBe(10_300_000);
    expect(ledger.balanceC).toBe(10_300_000);
    expect(ledger.status).toBe("Fully Funded");
  });

  it("charges a fixed amount once per investor", () => {
    const ledger = buildLoanLedger(
      loan({
        loanInvestors: [
          {
            id: 1,
            investor: { id: 7, name: "Ana" },
            amount: "100000",
            interestRate: "2500",
            interestType: "fixed",
            isPaid: true,
          },
        ],
      }),
      { today: TODAY },
    );
    expect(ledger.interestExpectedC).toBe(250_000);
    expect(ledger.dueC).toBe(10_250_000);
  });

  it("uses the investor's total capital for multi-period rate interest", () => {
    const ledger = buildLoanLedger(
      loan({
        loanInvestors: [
          {
            id: 1,
            investor: { id: 7, name: "Ana" },
            amount: "100000",
            interestRate: "0",
            hasMultipleInterest: true,
            isPaid: true,
            interestPeriods: [
              { id: 11, dueDate: "2026-03-31", interestRate: "5" },
              { id: 12, dueDate: "2026-06-30", interestRate: "5" },
            ],
          },
          {
            id: 2,
            investor: { id: 7, name: "Ana" },
            amount: "50000",
            interestRate: "0",
            isPaid: true,
          },
        ],
      }),
      { today: TODAY },
    );
    expect(ledger.principalC).toBe(15_000_000);
    expect(ledger.interestExpectedC).toBe(1_500_000);
    expect(ledger.dueC).toBe(16_500_000);
  });

  it("gives a zero-capital agent interest on the loan principal (D-1)", () => {
    const ledger = buildLoanLedger(
      loan({
        loanInvestors: [
          {
            id: 1,
            investor: { id: 7, name: "Ana" },
            amount: "100000",
            interestRate: "3",
            isPaid: true,
          },
          {
            id: 2,
            investor: { id: 8, name: "Agent" },
            amount: "0",
            interestRate: "3",
            isPaid: true,
          },
        ],
      }),
      { today: TODAY },
    );
    expect(ledger.principalC).toBe(10_000_000);
    // Ana: 3% of 100k. Agent: 3% of the whole 100k principal.
    expect(ledger.interestExpectedC).toBe(600_000);
  });

  it("derives Completed from a linked payment", () => {
    const ledger = buildLoanLedger(
      loan({
        loanInvestors: [
          {
            id: 1,
            investor: { id: 7, name: "Ana" },
            amount: "100000",
            interestRate: "0",
            hasMultipleInterest: true,
            isPaid: true,
            interestPeriods: [
              { id: 11, dueDate: "2026-01-31", interestRate: "3" },
              { id: 12, dueDate: "2026-06-30", interestRate: "3" },
            ],
            receivedPayments: [
              { id: 51, interestPeriodId: 11, amount: "3000" },
            ],
          },
        ],
      }),
      { today: TODAY },
    );
    expect(ledger.investors[0].periods[0].status).toBe("Completed");
    expect(ledger.investors[0].periods[0].paidC).toBe(300_000);
    expect(ledger.investors[0].interestPaidC).toBe(300_000);
    expect(ledger.status).toBe("Fully Funded");
  });

  it("marks a partial period Incomplete", () => {
    const ledger = buildLoanLedger(
      loan({
        loanInvestors: [
          {
            id: 1,
            investor: { id: 7, name: "Ana" },
            amount: "100000",
            interestRate: "0",
            hasMultipleInterest: true,
            isPaid: true,
            interestPeriods: [
              { id: 11, dueDate: "2026-01-31", interestRate: "3" },
              { id: 12, dueDate: "2026-06-30", interestRate: "3" },
            ],
            receivedPayments: [
              { id: 51, interestPeriodId: 11, amount: "1000" },
            ],
          },
        ],
      }),
      { today: TODAY },
    );
    const period = ledger.investors[0].periods[0];
    expect(period.status).toBe("Incomplete");
    expect(period.remainingC).toBe(200_000);
    expect(ledger.status).toBe("Overdue");
    expect(ledger.overdueC).toBe(200_000);
  });

  it("allocates an unlinked payment to the oldest open interest (D-14)", () => {
    const ledger = buildLoanLedger(
      loan({
        loanInvestors: [
          {
            id: 1,
            investor: { id: 7, name: "Ana" },
            amount: "100000",
            interestRate: "0",
            hasMultipleInterest: true,
            isPaid: true,
            interestPeriods: [
              { id: 11, dueDate: "2026-01-31", interestRate: "3" },
              { id: 12, dueDate: "2026-06-30", interestRate: "3" },
            ],
            receivedPayments: [{ id: 51, amount: "3000" }],
          },
        ],
      }),
      { today: TODAY },
    );
    expect(ledger.investors[0].periods[0].status).toBe("Completed");
    expect(ledger.investors[0].periods[0].paidC).toBe(300_000);
  });

  it("is not overdue on the due date, but is the day after (D-2)", () => {
    const onDue = buildLoanLedger(loan(), { today: "2026-06-30" });
    expect(onDue.status).toBe("Fully Funded");
    expect(onDue.overdueC).toBe(0);

    const afterDue = buildLoanLedger(loan(), { today: "2026-07-01" });
    expect(afterDue.status).toBe("Overdue");
    expect(afterDue.overdueC).toBe(10_300_000);
  });

  it("does not mark a loan Completed while principal is unpaid (STAT-03)", () => {
    // All interest periods paid, principal untouched.
    const ledger = buildLoanLedger(
      loan({
        loanInvestors: [
          {
            id: 1,
            investor: { id: 7, name: "Ana" },
            amount: "100000",
            interestRate: "0",
            hasMultipleInterest: true,
            isPaid: true,
            interestPeriods: [
              { id: 11, dueDate: "2026-01-31", interestRate: "3" },
              { id: 12, dueDate: "2026-06-30", interestRate: "3" },
            ],
            receivedPayments: [
              { id: 51, interestPeriodId: 11, amount: "3000" },
              { id: 52, interestPeriodId: 12, amount: "3000" },
            ],
          },
        ],
      }),
      { today: TODAY },
    );
    expect(ledger.balanceC).toBe(10_000_000);
    expect(ledger.status).toBe("Fully Funded");
  });

  it("marks Completed when principal and interest are fully received", () => {
    const ledger = buildLoanLedger(
      loan({
        loanInvestors: [
          {
            id: 1,
            investor: { id: 7, name: "Ana" },
            amount: "100000",
            interestRate: "3",
            isPaid: true,
            receivedPayments: [{ id: 51, amount: "103000" }],
          },
        ],
      }),
      { today: TODAY },
    );
    expect(ledger.balanceC).toBe(0);
    expect(ledger.status).toBe("Completed");
  });

  it("counts an investor's two loans separately (CALC-02)", () => {
    const loanA = buildLoanLedger(
      loan({
        loanInvestors: [
          {
            id: 1,
            investor: { id: 7, name: "Ana" },
            amount: "100000",
            interestRate: "0",
            hasMultipleInterest: true,
            isPaid: true,
            interestPeriods: [
              { id: 11, dueDate: "2026-03-31", interestRate: "3" },
              { id: 12, dueDate: "2026-06-30", interestRate: "3" },
            ],
          },
        ],
      }),
      { today: TODAY },
    );
    const loanB = buildLoanLedger(
      loan({
        loanInvestors: [
          {
            id: 2,
            investor: { id: 7, name: "Ana" },
            amount: "200000",
            interestRate: "10",
            isPaid: true,
          },
        ],
      }),
      { today: TODAY },
    );
    // 6,000 + 20,000, never the 18,000 the old merged grouping produced.
    expect(loanA.interestExpectedC + loanB.interestExpectedC).toBe(2_600_000);
  });

  it("is stable when tranche order changes", () => {
    const base = loan();
    const first = buildLoanLedger(base, { today: TODAY });
    const reversed = buildLoanLedger(
      {
        ...base,
        loanInvestors: [
          ...base.loanInvestors,
          {
            id: 2,
            investor: { id: 7, name: "Ana" },
            amount: "50000",
            interestRate: "3",
            isPaid: true,
          },
        ],
      },
      { today: TODAY },
    );
    const reordered = buildLoanLedger(
      {
        ...base,
        loanInvestors: [
          {
            id: 2,
            investor: { id: 7, name: "Ana" },
            amount: "50000",
            interestRate: "3",
            isPaid: true,
          },
          ...base.loanInvestors,
        ],
      },
      { today: TODAY },
    );
    expect(reordered.dueC).toBe(reversed.dueC);
    expect(first.dueC).toBe(10_300_000);
  });

  it("buckets schedule rows by date and sums to the loan total", () => {
    const ledger = buildLoanLedger(
      loan({
        loanInvestors: [
          {
            id: 1,
            investor: { id: 7, name: "Ana" },
            amount: "100000",
            interestRate: "0",
            hasMultipleInterest: true,
            isPaid: true,
            interestPeriods: [
              { id: 11, dueDate: "2026-03-31", interestRate: "3" },
              { id: 12, dueDate: "2026-06-30", interestRate: "3" },
            ],
          },
        ],
      }),
      { today: TODAY },
    );
    const dueSum = ledger.dueRows.reduce((sum, row) => sum + row.totalC, 0);
    const interestSum = ledger.interestRows.reduce(
      (sum, row) => sum + row.interestC,
      0,
    );
    expect(dueSum + interestSum).toBe(ledger.dueC);
  });
});

describe("sumLedgers", () => {
  it("adds portfolio totals across loans", () => {
    const a = buildLoanLedger(loan(), { today: TODAY });
    const b = buildLoanLedger(
      loan({
        loanInvestors: [
          {
            id: 2,
            investor: { id: 8, name: "Ben" },
            amount: "50000",
            interestRate: "2",
            isPaid: true,
          },
        ],
      }),
      { today: TODAY },
    );
    const total = sumLedgers([a, b]);
    expect(total.principalC).toBe(15_000_000);
    expect(total.interestExpectedC).toBe(400_000);
    expect(total.dueC).toBe(15_400_000);
    expect(total.balanceC).toBe(15_400_000);
    expect(total.receivedC).toBe(0);
    expect(total.overdueC).toBe(0);
  });
});
