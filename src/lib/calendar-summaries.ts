import { toLocalDateString } from "$lib/date-utils";
import type { LoanWithInvestors } from "$lib/types";

export type DailySummaryDay = {
  out: { loans: LoanWithInvestors[]; amount: number };
  in: { loans: LoanWithInvestors[]; amount: number };
  loanAmounts: Map<number, { amount: number; isOut: boolean }>;
};

/** Dates whose daily summaries may change when a loan is updated. */
export function getAffectedDatesFromLoan(loan: LoanWithInvestors): Date[] {
  const dates: Date[] = [];
  const dateSet = new Set<string>();

  loan.loanInvestors.forEach((li) => {
    const dateKey = toLocalDateString(li.sentDate);
    if (!dateSet.has(dateKey)) {
      dateSet.add(dateKey);
      dates.push(new Date(li.sentDate));
    }
  });

  const hasAnyMultipleInterest = loan.loanInvestors.some(
    (li) =>
      li.hasMultipleInterest &&
      li.interestPeriods &&
      li.interestPeriods.length > 0,
  );

  if (hasAnyMultipleInterest) {
    for (const li of loan.loanInvestors) {
      if (
        li.hasMultipleInterest &&
        li.interestPeriods &&
        li.interestPeriods.length > 0
      ) {
        for (const period of li.interestPeriods) {
          const dateKey = toLocalDateString(period.dueDate);
          if (!dateSet.has(dateKey)) {
            dateSet.add(dateKey);
            dates.push(new Date(period.dueDate));
          }
        }
      }
    }
  } else {
    const dateKey = toLocalDateString(loan.dueDate);
    if (!dateSet.has(dateKey)) {
      dateSet.add(dateKey);
      dates.push(new Date(loan.dueDate));
    }
  }

  return dates;
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
    const sentDateMap = new Map<string, number>();
    loan.loanInvestors.forEach((li) => {
      const dateKey = toLocalDateString(li.sentDate);
      const amount = parseFloat(li.amount);
      sentDateMap.set(dateKey, (sentDateMap.get(dateKey) || 0) + amount);
    });

    for (const [dateKey, amount] of sentDateMap.entries()) {
      const dayData = ensureDay(dateKey);
      if (!dayData.out.loans.find((l) => l.id === loan.id)) {
        dayData.out.loans.push(loan);
      }
      dayData.out.amount += amount;
      const existing = dayData.loanAmounts.get(loan.id);
      if (existing) {
        existing.amount -= amount;
      } else {
        dayData.loanAmounts.set(loan.id, { amount: -amount, isOut: true });
      }
    }

    const hasAnyMultipleInterest = loan.loanInvestors.some(
      (li) =>
        li.hasMultipleInterest &&
        li.interestPeriods &&
        li.interestPeriods.length > 0,
    );

    if (hasAnyMultipleInterest) {
      for (const li of loan.loanInvestors) {
        if (
          !li.hasMultipleInterest ||
          !li.interestPeriods ||
          li.interestPeriods.length === 0
        ) {
          continue;
        }
        const sortedPeriods = [...li.interestPeriods].sort(
          (a, b) =>
            new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime(),
        );

        for (let i = 0; i < sortedPeriods.length; i++) {
          const period = sortedPeriods[i];
          const isLastPeriod = i === sortedPeriods.length - 1;
          const dateKey = toLocalDateString(period.dueDate);
          const principal = parseFloat(li.amount);
          const interest =
            period.interestType === "rate"
              ? principal * (parseFloat(period.interestRate) / 100)
              : parseFloat(period.interestRate);
          const totalAmount = isLastPeriod ? principal + interest : interest;
          const dayData = ensureDay(dateKey);
          if (!dayData.in.loans.find((l) => l.id === loan.id)) {
            dayData.in.loans.push(loan);
          }
          dayData.in.amount += totalAmount;
          const existing = dayData.loanAmounts.get(loan.id);
          if (existing) {
            existing.amount += totalAmount;
            existing.isOut = existing.amount < 0;
          } else {
            dayData.loanAmounts.set(loan.id, {
              amount: totalAmount,
              isOut: false,
            });
          }
        }
      }
    } else {
      const dateKey = toLocalDateString(loan.dueDate);
      const totalPrincipal = loan.loanInvestors.reduce(
        (sum, li) => sum + parseFloat(li.amount),
        0,
      );
      const totalInterest = loan.loanInvestors.reduce((sum, li) => {
        const capital = parseFloat(li.amount);
        if (li.interestType === "rate") {
          const rate = parseFloat(li.interestRate) / 100;
          return sum + capital * rate;
        }
        return sum + parseFloat(li.interestRate);
      }, 0);
      const totalAmount = totalPrincipal + totalInterest;
      const dayData = ensureDay(dateKey);
      if (!dayData.in.loans.find((l) => l.id === loan.id)) {
        dayData.in.loans.push(loan);
      }
      dayData.in.amount += totalAmount;
      const existing = dayData.loanAmounts.get(loan.id);
      if (existing) {
        existing.amount += totalAmount;
        existing.isOut = existing.amount < 0;
      } else {
        dayData.loanAmounts.set(loan.id, {
          amount: totalAmount,
          isOut: false,
        });
      }
    }
  }

  return dailyEvents;
}
