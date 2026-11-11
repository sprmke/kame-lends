import { calculateInterest } from "$lib/calculations";
import { toLocalDateString } from "$lib/date-utils";
import type {
  InterestPeriod,
  LoanInvestor,
  LoanWithInvestors,
} from "$lib/types";

/**
 * A loan's payment schedule after grouping allocations the same way the loan
 * detail and `calculateTotalInterest` group them (one interest schedule per
 * investor, applied to that investor's total capital).
 *
 * `dues` are loan-level due rows. `interests` are the interim interest rows
 * that are still shown separately (already paid, or not due yet).
 */
export type ScheduledLoanDue = {
  date: Date;
  dateKey: string;
  investors: Array<{ name: string; amount: number }>;
  totalPrincipal: number;
  totalInterest: number;
  totalAmount: number;
};

export type ScheduledInterestDue = {
  date: Date;
  dateKey: string;
  loanInvestor: LoanInvestor & { investor: { name: string } };
  interestPeriod: InterestPeriod;
  principal: number;
  interest: number;
  totalAmount: number;
};

export type LoanPaymentSchedule = {
  dues: ScheduledLoanDue[];
  interests: ScheduledInterestDue[];
};

type LoanInvestorWithName = LoanInvestor & { investor: { name: string } };

function money(value: string | number | null | undefined): number {
  const parsed = typeof value === "number" ? value : parseFloat(String(value));
  return Number.isFinite(parsed) ? parsed : 0;
}

function periodInterest(principal: number, period: InterestPeriod): number {
  return calculateInterest(principal, period.interestRate, period.interestType);
}

/**
 * Interest that has already fallen due and was not collected is carried into
 * the loan's due row so the due amount matches the outstanding balance.
 * Completed rows keep their own interest event; future rows stay scheduled.
 */
function rollsIntoDue(period: InterestPeriod): boolean {
  return period.status === "Overdue" || period.status === "Incomplete";
}

function groupByInvestor(
  loanInvestors: LoanWithInvestors["loanInvestors"],
): Map<number, LoanInvestorWithName[]> {
  const groups = new Map<number, LoanInvestorWithName[]>();
  for (const allocation of loanInvestors) {
    const investorId = allocation.investor?.id ?? allocation.investorId;
    const existing = groups.get(investorId);
    if (existing) existing.push(allocation);
    else groups.set(investorId, [allocation]);
  }
  return groups;
}

/**
 * Builds the money rows for a loan used by the in-app calendar, the timeline,
 * Google Calendar, Telegram reminders, and daily summaries.
 *
 * Multi-period investors: the last period is the loan due row (principal +
 * final interest unless that interest was already collected, plus any
 * unpaid/overdue earlier interest). Completed or future-pending interest
 * keeps its own row.
 *
 * Single-interest investors: one due row at the loan due date.
 *
 * Rows are grouped per investor (and per date) so the total across the
 * schedule equals `calculateTotalAmount(loan.loanInvestors)`.
 */
export function buildLoanPaymentSchedule(
  loan: LoanWithInvestors,
): LoanPaymentSchedule {
  const loanTotalPrincipal = loan.loanInvestors.reduce(
    (sum, allocation) => sum + money(allocation.amount),
    0,
  );
  const loanDueDate =
    loan.dueDate instanceof Date ? loan.dueDate : new Date(loan.dueDate);
  const dueByDate = new Map<string, ScheduledLoanDue>();
  const interests: ScheduledInterestDue[] = [];

  const addDue = (
    date: Date,
    investorName: string,
    principal: number,
    interest: number,
  ) => {
    const dateKey = toLocalDateString(date);
    const existing = dueByDate.get(dateKey);
    const row: ScheduledLoanDue = existing ?? {
      date,
      dateKey,
      investors: [],
      totalPrincipal: 0,
      totalInterest: 0,
      totalAmount: 0,
    };

    row.investors.push({
      name: investorName,
      amount: principal + interest,
    });
    row.totalPrincipal += principal;
    row.totalInterest += interest;
    row.totalAmount += principal + interest;
    dueByDate.set(dateKey, row);
  };

  for (const allocations of groupByInvestor(loan.loanInvestors).values()) {
    const investorCapital = allocations.reduce(
      (sum, allocation) => sum + money(allocation.amount),
      0,
    );
    const withPeriods = allocations.find(
      (allocation) =>
        allocation.hasMultipleInterest &&
        allocation.interestPeriods &&
        allocation.interestPeriods.length > 0,
    );
    const investorName = allocations[0]?.investor?.name ?? "";

    if (withPeriods?.interestPeriods?.length) {
      const periods = [...withPeriods.interestPeriods].sort(
        (a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime(),
      );
      const base = investorCapital === 0 ? loanTotalPrincipal : investorCapital;
      let rolledInterest = 0;

      periods.forEach((period, index) => {
        const interest = periodInterest(base, period);
        const isFinalPeriod = index === periods.length - 1;

        if (isFinalPeriod) {
          if (period.status === "Completed") {
            // The final interest was already collected. Keep it on its own
            // row so the due row is the outstanding principal plus any
            // earlier unpaid interest.
            interests.push({
              date: new Date(period.dueDate),
              dateKey: toLocalDateString(period.dueDate),
              loanInvestor: withPeriods,
              interestPeriod: period,
              principal: investorCapital,
              interest,
              totalAmount: interest,
            });
            addDue(
              new Date(period.dueDate),
              investorName,
              investorCapital,
              rolledInterest,
            );
            return;
          }

          addDue(
            new Date(period.dueDate),
            investorName,
            investorCapital,
            interest + rolledInterest,
          );
          return;
        }

        if (rollsIntoDue(period)) {
          rolledInterest += interest;
          return;
        }

        interests.push({
          date: new Date(period.dueDate),
          dateKey: toLocalDateString(period.dueDate),
          loanInvestor: withPeriods,
          interestPeriod: period,
          principal: investorCapital,
          interest,
          totalAmount: interest,
        });
      });
      continue;
    }

    const interest = allocations.reduce((sum, allocation) => {
      const capital = money(allocation.amount);
      const base = capital === 0 ? loanTotalPrincipal : capital;
      return (
        sum +
        calculateInterest(
          base,
          allocation.interestRate,
          allocation.interestType,
        )
      );
    }, 0);

    addDue(loanDueDate, investorName, investorCapital, interest);
  }

  const byDate = (a: { dateKey: string }, b: { dateKey: string }) =>
    a.dateKey.localeCompare(b.dateKey);

  return {
    dues: [...dueByDate.values()].sort(byDate),
    interests: interests.sort(byDate),
  };
}
