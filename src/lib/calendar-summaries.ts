import { draftLoanGoogleEvents } from "$lib/calendar-events";
import { buildLoanPaymentSchedule } from "$lib/loan-payment-schedule";
import { toLocalDateString } from "$lib/date-utils";
import type { LoanWithInvestors } from "$lib/types";

export type DailySummaryDay = {
  out: { loans: LoanWithInvestors[]; amount: number };
  in: { loans: LoanWithInvestors[]; amount: number };
  loanAmounts: Map<number, { amount: number; isOut: boolean }>;
};

/** Dates whose daily summaries may change when a loan is updated. */
export function getAffectedDatesFromLoan(loan: LoanWithInvestors): Date[] {
  const dateSet = new Map<string, Date>();

  const add = (date: Date | string) => {
    const key = toLocalDateString(date);
    if (!dateSet.has(key)) dateSet.set(key, new Date(date));
  };

  loan.loanInvestors.forEach((li) => {
    add(li.sentDate);
    // Include every period date, including ones that now roll into the due
    // row, so stale daily summary events get cleared.
    if (li.hasMultipleInterest && li.interestPeriods) {
      li.interestPeriods.forEach((period) => add(period.dueDate));
    }
  });

  const schedule = buildLoanPaymentSchedule(loan);
  schedule.dues.forEach((due) => add(due.date));
  schedule.interests.forEach((interest) => add(interest.date));

  return [...dateSet.values()];
}

/** Pure daily cash-flow rollup for group Google Calendar summaries. */
export function collectDailySummaryDays(
  loans: LoanWithInvestors[],
): Map<string, DailySummaryDay> {
  const dailyEvents = new Map<string, DailySummaryDay>();

  function ensureDay(dateKey: string): DailySummaryDay {
    if (!dailyEvents.has(dateKey)) {
      dailyEvents.set(dateKey, {
        out: { loans: [], amount: 0 },
        in: { loans: [], amount: 0 },
        loanAmounts: new Map(),
      });
    }
    return dailyEvents.get(dateKey)!;
  }

  for (const loan of loans) {
    for (const draft of draftLoanGoogleEvents(loan, "all")) {
      const dayData = ensureDay(draft.dateKey);
      const isOut = draft.type === "sent";
      const bucket = isOut ? dayData.out : dayData.in;

      if (!bucket.loans.find((row) => row.id === loan.id)) {
        bucket.loans.push(loan);
      }
      bucket.amount += draft.totalAmount;

      const existing = dayData.loanAmounts.get(loan.id);
      const signedAmount = isOut ? -draft.totalAmount : draft.totalAmount;
      if (existing) {
        existing.amount += signedAmount;
        existing.isOut = existing.amount < 0;
      } else {
        dayData.loanAmounts.set(loan.id, {
          amount: signedAmount,
          isOut,
        });
      }
    }
  }

  return dailyEvents;
}
