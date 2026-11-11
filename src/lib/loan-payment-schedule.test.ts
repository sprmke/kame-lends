import { describe, expect, it } from "vitest";
import { calculateTotalAmount } from "$lib/calculations";
import { buildLoanPaymentSchedule } from "./loan-payment-schedule";
import type {
  InterestPeriod,
  InterestPeriodStatus,
  Investor,
  LoanInvestor,
  LoanWithInvestors,
} from "$lib/types";

const investorA: Investor = {
  id: 1,
  name: "Ada",
  email: "ada@example.com",
  contactNumber: null,
  address: null,
  validIdUrl: null,
  eSignatureUrl: null,
  createdAt: new Date("2026-01-01T00:00:00.000Z"),
  updatedAt: new Date("2026-01-01T00:00:00.000Z"),
};

const investorB: Investor = { ...investorA, id: 2, name: "Bob" };

function period(
  id: number,
  loanInvestorId: number,
  dueDate: string,
  status: InterestPeriodStatus,
  interestRate = "10",
  interestType: InterestPeriod["interestType"] = "rate",
): InterestPeriod {
  return {
    id,
    loanInvestorId,
    dueDate: new Date(`${dueDate}T00:00:00.000Z`),
    interestRate,
    interestType,
    status,
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    updatedAt: new Date("2026-01-01T00:00:00.000Z"),
  };
}

function allocation(
  id: number,
  investor: Investor,
  amount: string,
  sentDate: string,
  interestPeriods: InterestPeriod[] = [],
): LoanInvestor & { investor: Investor } {
  return {
    id,
    loanId: 139,
    investorId: investor.id,
    amount,
    interestRate: "10",
    interestType: "rate",
    sentDate: new Date(`${sentDate}T00:00:00.000Z`),
    isPaid: true,
    hasMultipleInterest: interestPeriods.length > 0,
    profitType: "rate",
    profitValue: "0",
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    updatedAt: new Date("2026-01-01T00:00:00.000Z"),
    interestPeriods,
    investor,
  };
}

function loan(
  loanInvestors: LoanWithInvestors["loanInvestors"],
  dueDate = "2026-11-09",
): LoanWithInvestors {
  return {
    id: 139,
    borrowerId: null,
    loanName: "Agent Loan (Sep 13 - Nov 9)",
    type: "Agent",
    status: "Overdue",
    dueDate: new Date(`${dueDate}T00:00:00.000Z`),
    freeLotSqm: null,
    notes: null,
    userId: "user-1",
    profitType: "rate",
    profitValue: "0",
    createdAt: new Date("2026-09-13T00:00:00.000Z"),
    updatedAt: new Date("2026-09-13T00:00:00.000Z"),
    loanInvestors,
  };
}

describe("buildLoanPaymentSchedule", () => {
  it("carries unpaid multi-period interest into the loan due row", () => {
    const reportedLoan = loan([
      allocation(630, investorA, "350000", "2026-09-13", [
        period(1272, 630, "2026-09-27", "Overdue"),
        period(1273, 630, "2026-10-11", "Overdue"),
        period(1274, 630, "2026-10-25", "Overdue"),
        period(1275, 630, "2026-11-09", "Overdue"),
      ]),
      allocation(631, investorB, "130000", "2026-09-13", [
        period(1276, 631, "2026-09-27", "Overdue"),
        period(1277, 631, "2026-10-11", "Overdue"),
        period(1278, 631, "2026-10-25", "Overdue"),
        period(1279, 631, "2026-11-09", "Overdue"),
      ]),
    ]);

    const schedule = buildLoanPaymentSchedule(reportedLoan);

    expect(schedule.interests).toEqual([]);
    expect(schedule.dues).toHaveLength(1);
    expect(schedule.dues[0]).toMatchObject({
      dateKey: "2026-11-09",
      totalPrincipal: 480000,
      totalInterest: 192000,
      totalAmount: 672000,
    });
    expect(schedule.dues[0]?.investors).toEqual([
      { name: "Ada", amount: 490000 },
      { name: "Bob", amount: 182000 },
    ]);
    expect(schedule.dues[0]?.totalAmount).toBe(
      calculateTotalAmount(reportedLoan.loanInvestors),
    );
  });

  it("keeps paid and upcoming interest on their own dates and rolls only overdue interest", () => {
    const single = loan(
      [
        allocation(700, investorA, "100000", "2026-08-01", [
          period(1, 700, "2026-09-01", "Completed"),
          period(2, 700, "2026-10-01", "Overdue"),
          period(3, 700, "2026-11-01", "Pending"),
        ]),
      ],
      "2026-11-01",
    );

    const schedule = buildLoanPaymentSchedule(single);

    expect(schedule.interests).toHaveLength(1);
    expect(schedule.interests[0]).toMatchObject({
      dateKey: "2026-09-01",
      principal: 100000,
      interest: 10000,
      totalAmount: 10000,
    });
    expect(schedule.dues).toHaveLength(1);
    expect(schedule.dues[0]).toMatchObject({
      dateKey: "2026-11-01",
      totalPrincipal: 100000,
      totalInterest: 20000,
      totalAmount: 120000,
    });
    expect(
      schedule.dues[0]!.totalAmount +
        schedule.interests.reduce((sum, row) => sum + row.totalAmount, 0),
    ).toBe(calculateTotalAmount(single.loanInvestors));
  });

  it("does not duplicate an investor's copied period schedule across disbursement rows", () => {
    const repeated = loan(
      [
        allocation(800, investorA, "60000", "2026-08-01", [
          period(10, 800, "2026-09-01", "Completed"),
          period(11, 800, "2026-10-01", "Overdue"),
        ]),
        allocation(801, investorA, "40000", "2026-08-15", [
          period(12, 801, "2026-09-01", "Completed"),
          period(13, 801, "2026-10-01", "Overdue"),
        ]),
      ],
      "2026-10-01",
    );

    const schedule = buildLoanPaymentSchedule(repeated);

    expect(schedule.interests).toHaveLength(1);
    expect(schedule.interests[0]?.totalAmount).toBe(10000);
    expect(schedule.dues).toHaveLength(1);
    expect(schedule.dues[0]).toMatchObject({
      totalPrincipal: 100000,
      totalInterest: 10000,
      totalAmount: 110000,
    });
    expect(schedule.interests[0]?.principal).toBe(100000);
  });

  it("keeps a completed final interest on its own row so the due row is principal only", () => {
    const completedFinal = loan(
      [
        allocation(1200, investorA, "100000", "2026-08-01", [
          period(40, 1200, "2026-09-01", "Completed"),
          period(41, 1200, "2026-10-01", "Completed"),
        ]),
      ],
      "2026-10-01",
    );

    const schedule = buildLoanPaymentSchedule(completedFinal);

    expect(schedule.interests.map((row) => row.totalAmount)).toEqual([
      10000, 10000,
    ]);
    expect(schedule.dues).toHaveLength(1);
    expect(schedule.dues[0]).toMatchObject({
      dateKey: "2026-10-01",
      totalPrincipal: 100000,
      totalInterest: 0,
      totalAmount: 100000,
    });
    expect(
      schedule.dues[0]!.totalAmount +
        schedule.interests.reduce((sum, row) => sum + row.totalAmount, 0),
    ).toBe(calculateTotalAmount(completedFinal.loanInvestors));
  });

  it("uses the same grouped interest schedule as the loan totals", () => {
    const differentSchedules = loan(
      [
        allocation(900, investorA, "200000", "2026-01-01", [
          period(20, 900, "2026-02-01", "Overdue", "15"),
          period(21, 900, "2026-03-01", "Overdue", "15"),
        ]),
        allocation(901, investorA, "300000", "2026-02-01", [
          period(22, 901, "2026-02-01", "Overdue", "8"),
          period(23, 901, "2026-03-01", "Overdue", "8"),
        ]),
      ],
      "2026-03-01",
    );

    const schedule = buildLoanPaymentSchedule(differentSchedules);
    const scheduledTotal =
      schedule.dues.reduce((sum, row) => sum + row.totalAmount, 0) +
      schedule.interests.reduce((sum, row) => sum + row.totalAmount, 0);

    expect(scheduledTotal).toBe(
      calculateTotalAmount(differentSchedules.loanInvestors),
    );
    expect(schedule.dues).toHaveLength(1);
    expect(schedule.dues[0]?.totalAmount).toBe(
      calculateTotalAmount(differentSchedules.loanInvestors),
    );
  });

  it("keeps a single-interest investor on a loan that also has interest periods", () => {
    const mixed = loan(
      [
        allocation(1000, investorA, "100000", "2026-08-01", [
          period(30, 1000, "2026-09-01", "Overdue"),
          period(31, 1000, "2026-10-01", "Overdue"),
        ]),
        allocation(1001, investorB, "50000", "2026-08-01"),
      ],
      "2026-09-15",
    );

    const schedule = buildLoanPaymentSchedule(mixed);

    expect(schedule.dues).toHaveLength(2);
    expect(
      schedule.dues.find((row) => row.dateKey === "2026-10-01"),
    ).toMatchObject({
      totalPrincipal: 100000,
      totalInterest: 20000,
      totalAmount: 120000,
    });
    expect(
      schedule.dues.find((row) => row.dateKey === "2026-09-15"),
    ).toMatchObject({
      totalPrincipal: 50000,
      totalInterest: 5000,
      totalAmount: 55000,
    });
  });

  it("builds one due row for a single-interest loan", () => {
    const simple = loan(
      [allocation(1100, investorA, "100000", "2026-09-01")],
      "2026-09-14",
    );

    const schedule = buildLoanPaymentSchedule(simple);

    expect(schedule.interests).toEqual([]);
    expect(schedule.dues).toEqual([
      expect.objectContaining({
        dateKey: "2026-09-14",
        totalPrincipal: 100000,
        totalInterest: 10000,
        totalAmount: 110000,
      }),
    ]);
  });
});
