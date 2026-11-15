/**
 * Hand-checked golden loans. Every expected value below was computed by hand
 * from the money model, not from the engine.
 *
 * Today is fixed per fixture so results never depend on the clock.
 */
import type { LedgerLoanInput } from "../ledger";

export interface GoldenLoan {
  name: string;
  today: string;
  loan: LedgerLoanInput;
  expected: {
    principalC: number;
    interestC: number;
    dueC: number;
    receivedC: number;
    balanceC: number;
    overdueC: number;
    status: string;
    periodStatuses?: string[];
  };
}

export const GOLDEN_LOANS: GoldenLoan[] = [
  {
    name: "Single interest, 100k at 3%",
    today: "2026-02-01",
    loan: {
      dueDate: "2026-06-30",
      loanInvestors: [
        {
          id: 1,
          investor: { id: 1, name: "Ana" },
          amount: "100000",
          interestRate: "3",
          interestType: "rate",
          isPaid: true,
        },
      ],
    },
    expected: {
      principalC: 10_000_000,
      interestC: 300_000,
      dueC: 10_300_000,
      receivedC: 0,
      balanceC: 10_300_000,
      overdueC: 0,
      status: "Fully Funded",
    },
  },
  {
    name: "Fixed interest, 100k + 2,500",
    today: "2026-02-01",
    loan: {
      dueDate: "2026-06-30",
      loanInvestors: [
        {
          id: 1,
          investor: { id: 1, name: "Ana" },
          amount: "100000",
          interestRate: "2500",
          interestType: "fixed",
          isPaid: true,
        },
      ],
    },
    expected: {
      principalC: 10_000_000,
      interestC: 250_000,
      dueC: 10_250_000,
      receivedC: 0,
      balanceC: 10_250_000,
      overdueC: 0,
      status: "Fully Funded",
    },
  },
  {
    name: "Two tranches, one investor, 3% each",
    today: "2026-02-01",
    loan: {
      dueDate: "2026-06-30",
      loanInvestors: [
        {
          id: 1,
          investor: { id: 1, name: "Ana" },
          amount: "100000",
          interestRate: "3",
          interestType: "rate",
          isPaid: true,
        },
        {
          id: 2,
          investor: { id: 1, name: "Ana" },
          amount: "50000",
          interestRate: "3",
          interestType: "rate",
          isPaid: true,
        },
      ],
    },
    expected: {
      principalC: 15_000_000,
      interestC: 450_000,
      dueC: 15_450_000,
      receivedC: 0,
      balanceC: 15_450_000,
      overdueC: 0,
      status: "Fully Funded",
    },
  },
  {
    name: "Agent (zero capital) earns on the loan principal",
    today: "2026-02-01",
    loan: {
      dueDate: "2026-06-30",
      loanInvestors: [
        {
          id: 1,
          investor: { id: 1, name: "Ana" },
          amount: "100000",
          interestRate: "3",
          interestType: "rate",
          isPaid: true,
        },
        {
          id: 2,
          investor: { id: 2, name: "Agent" },
          amount: "0",
          interestRate: "3",
          interestType: "rate",
          isPaid: true,
        },
      ],
    },
    expected: {
      principalC: 10_000_000,
      interestC: 600_000,
      dueC: 10_600_000,
      receivedC: 0,
      balanceC: 10_600_000,
      overdueC: 0,
      status: "Fully Funded",
    },
  },
  {
    name: "Multi-period 5% + 5% on 150k capital",
    today: "2026-02-01",
    loan: {
      dueDate: "2026-06-30",
      loanInvestors: [
        {
          id: 1,
          investor: { id: 1, name: "Ana" },
          amount: "100000",
          interestRate: "0",
          interestType: "rate",
          hasMultipleInterest: true,
          isPaid: true,
          interestPeriods: [
            { id: 11, dueDate: "2026-03-31", interestRate: "5" },
            { id: 12, dueDate: "2026-06-30", interestRate: "5" },
          ],
        },
        {
          id: 2,
          investor: { id: 1, name: "Ana" },
          amount: "50000",
          interestRate: "0",
          interestType: "rate",
          isPaid: true,
        },
      ],
    },
    expected: {
      principalC: 15_000_000,
      interestC: 1_500_000,
      dueC: 16_500_000,
      receivedC: 0,
      balanceC: 16_500_000,
      overdueC: 0,
      status: "Fully Funded",
    },
  },
  {
    name: "One period paid, final still open",
    today: "2026-04-15",
    loan: {
      dueDate: "2026-06-30",
      loanInvestors: [
        {
          id: 1,
          investor: { id: 1, name: "Ana" },
          amount: "100000",
          interestRate: "0",
          interestType: "rate",
          hasMultipleInterest: true,
          isPaid: true,
          interestPeriods: [
            { id: 11, dueDate: "2026-03-31", interestRate: "3" },
            { id: 12, dueDate: "2026-06-30", interestRate: "3" },
          ],
          receivedPayments: [{ id: 51, interestPeriodId: 11, amount: "3000" }],
        },
      ],
    },
    expected: {
      principalC: 10_000_000,
      interestC: 600_000,
      dueC: 10_600_000,
      receivedC: 300_000,
      balanceC: 10_300_000,
      overdueC: 0,
      status: "Fully Funded",
      periodStatuses: ["Completed", "Pending"],
    },
  },
  {
    name: "Partial period is overdue and Incomplete",
    today: "2026-04-15",
    loan: {
      dueDate: "2026-06-30",
      loanInvestors: [
        {
          id: 1,
          investor: { id: 1, name: "Ana" },
          amount: "100000",
          interestRate: "0",
          interestType: "rate",
          hasMultipleInterest: true,
          isPaid: true,
          interestPeriods: [
            { id: 11, dueDate: "2026-03-31", interestRate: "3" },
            { id: 12, dueDate: "2026-06-30", interestRate: "3" },
          ],
          receivedPayments: [{ id: 51, interestPeriodId: 11, amount: "1000" }],
        },
      ],
    },
    expected: {
      principalC: 10_000_000,
      interestC: 600_000,
      dueC: 10_600_000,
      receivedC: 100_000,
      balanceC: 10_500_000,
      overdueC: 200_000,
      status: "Overdue",
      periodStatuses: ["Incomplete", "Pending"],
    },
  },
  {
    name: "Due today is not overdue; the next day is",
    today: "2026-06-30",
    loan: {
      dueDate: "2026-06-30",
      loanInvestors: [
        {
          id: 1,
          investor: { id: 1, name: "Ana" },
          amount: "100000",
          interestRate: "3",
          interestType: "rate",
          isPaid: true,
        },
      ],
    },
    expected: {
      principalC: 10_000_000,
      interestC: 300_000,
      dueC: 10_300_000,
      receivedC: 0,
      balanceC: 10_300_000,
      overdueC: 0,
      status: "Fully Funded",
    },
  },
  {
    name: "Fully paid becomes Completed",
    today: "2026-02-01",
    loan: {
      dueDate: "2026-06-30",
      loanInvestors: [
        {
          id: 1,
          investor: { id: 1, name: "Ana" },
          amount: "100000",
          interestRate: "3",
          interestType: "rate",
          isPaid: true,
          receivedPayments: [{ id: 51, amount: "103000" }],
        },
      ],
    },
    expected: {
      principalC: 10_000_000,
      interestC: 300_000,
      dueC: 10_300_000,
      receivedC: 10_300_000,
      balanceC: 0,
      overdueC: 0,
      status: "Completed",
    },
  },
  {
    name: "All interest paid but principal outstanding is not Completed",
    today: "2026-04-15",
    loan: {
      dueDate: "2026-06-30",
      loanInvestors: [
        {
          id: 1,
          investor: { id: 1, name: "Ana" },
          amount: "100000",
          interestRate: "0",
          interestType: "rate",
          hasMultipleInterest: true,
          isPaid: true,
          interestPeriods: [
            { id: 11, dueDate: "2026-03-31", interestRate: "3" },
            { id: 12, dueDate: "2026-06-30", interestRate: "3" },
          ],
          receivedPayments: [
            { id: 51, interestPeriodId: 11, amount: "3000" },
            { id: 52, interestPeriodId: 12, amount: "3000" },
          ],
        },
      ],
    },
    expected: {
      principalC: 10_000_000,
      interestC: 600_000,
      dueC: 10_600_000,
      receivedC: 600_000,
      balanceC: 10_000_000,
      overdueC: 0,
      status: "Fully Funded",
      periodStatuses: ["Completed", "Completed"],
    },
  },
  {
    name: "Unlinked payment applies to the oldest interest first",
    today: "2026-04-15",
    loan: {
      dueDate: "2026-06-30",
      loanInvestors: [
        {
          id: 1,
          investor: { id: 1, name: "Ana" },
          amount: "100000",
          interestRate: "0",
          interestType: "rate",
          hasMultipleInterest: true,
          isPaid: true,
          interestPeriods: [
            { id: 11, dueDate: "2026-03-31", interestRate: "3" },
            { id: 12, dueDate: "2026-06-30", interestRate: "3" },
          ],
          receivedPayments: [{ id: 51, amount: "1000" }],
        },
      ],
    },
    expected: {
      principalC: 10_000_000,
      interestC: 600_000,
      dueC: 10_600_000,
      receivedC: 100_000,
      balanceC: 10_500_000,
      overdueC: 200_000,
      status: "Overdue",
      periodStatuses: ["Incomplete", "Pending"],
    },
  },
  {
    name: "Rounding: 33,333.33 at 3.33% is 1,110.00",
    today: "2026-02-01",
    loan: {
      dueDate: "2026-06-30",
      loanInvestors: [
        {
          id: 1,
          investor: { id: 1, name: "Ana" },
          amount: "33333.33",
          interestRate: "3.33",
          interestType: "rate",
          isPaid: true,
        },
      ],
    },
    expected: {
      principalC: 3_333_333,
      interestC: 111_000,
      dueC: 3_444_333,
      receivedC: 0,
      balanceC: 3_444_333,
      overdueC: 0,
      status: "Fully Funded",
    },
  },
];
