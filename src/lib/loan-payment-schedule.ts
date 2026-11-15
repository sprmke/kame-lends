import { buildLoanLedger } from "$lib/money/ledger";
import { centavosToPesos } from "$lib/money/centavos";
import { dateKeyToUtcMidnight } from "$lib/dates/business-date";
import type {
  InterestPeriod,
  LoanInvestor,
  LoanWithInvestors,
} from "$lib/types";

/**
 * A loan's payment schedule. It is a view over the single money engine
 * (`buildLoanLedger`), grouped the same way every other screen groups it: one
 * interest schedule per investor within the loan, applied to that investor's
 * total capital.
 *
 * `dues` are loan-level due rows. `interests` are interim interest rows shown
 * separately (already paid, or not due yet).
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

/**
 * Builds the money rows for a loan used by the in-app calendar, the timeline,
 * Google Calendar, Telegram reminders, and daily summaries.
 */
export function buildLoanPaymentSchedule(
  loan: LoanWithInvestors,
  options: { today?: string } = {},
): LoanPaymentSchedule {
  const ledger = buildLoanLedger(loan, { today: options.today });

  const dues: ScheduledLoanDue[] = ledger.dueRows.map((row) => ({
    date: dateKeyToUtcMidnight(row.dateKey),
    dateKey: row.dateKey,
    investors: row.investors.map((investor) => ({
      name: investor.name,
      amount: centavosToPesos(investor.amountC),
    })),
    totalPrincipal: centavosToPesos(row.principalC),
    totalInterest: centavosToPesos(row.interestC),
    totalAmount: centavosToPesos(row.totalC),
  }));

  const periodsById = new Map<
    number,
    { period: InterestPeriod; allocation: LoanInvestor }
  >();
  for (const allocation of loan.loanInvestors) {
    for (const period of allocation.interestPeriods ?? []) {
      periodsById.set(period.id, { period, allocation });
    }
  }

  const interests: ScheduledInterestDue[] = [];
  for (const row of ledger.interestRows) {
    const match = row.periodId != null ? periodsById.get(row.periodId) : null;
    if (!match) continue;
    const { period, allocation } = match;
    const loanInvestor = {
      ...allocation,
      investor: { name: row.name },
    } as LoanInvestor & { investor: { name: string } };
    interests.push({
      date: dateKeyToUtcMidnight(row.dateKey),
      dateKey: row.dateKey,
      loanInvestor,
      interestPeriod: period,
      principal: centavosToPesos(
        ledger.investors.find(
          (investor) => investor.investorId === row.investorId,
        )?.capitalC ?? 0,
      ),
      interest: centavosToPesos(row.interestC),
      totalAmount: centavosToPesos(row.interestC),
    });
  }

  return { dues, interests };
}
