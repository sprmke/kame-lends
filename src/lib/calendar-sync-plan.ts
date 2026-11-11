import { buildLoanPaymentSchedule } from "$lib/loan-payment-schedule";
import { toLocalDateString } from "$lib/date-utils";
import type { LoanWithInvestors } from "$lib/types";

export type CalendarSyncScope = "all" | "open" | "upcoming";

export type PlannedLoanCalendarEvent = {
  type: "sent" | "due" | "interest_due";
  dateKey: string;
};

export type PlannedLoanSync = {
  loanId: number;
  loanName: string;
  dates: string[];
  eventCount: number;
};

/** YYYY-MM-DD in Asia/Manila. */
export function manilaTodayKey(now: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Manila",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

export function isDateInSyncScope(
  date: Date | string,
  scope: CalendarSyncScope,
  todayKey: string = manilaTodayKey(),
): boolean {
  if (scope === "upcoming") return toLocalDateString(date) >= todayKey;
  return true;
}

export function isLoanInSyncScope(
  loan: LoanWithInvestors,
  scope: CalendarSyncScope,
): boolean {
  if (scope === "open") return loan.status !== "Completed";
  return true;
}

export function planLoanCalendarEvents(
  loan: LoanWithInvestors,
  scope: CalendarSyncScope = "all",
  todayKey: string = manilaTodayKey(),
): PlannedLoanCalendarEvent[] {
  if (!isLoanInSyncScope(loan, scope)) return [];
  const events: PlannedLoanCalendarEvent[] = [];
  const sentDateKeys = new Set<string>();

  for (const li of loan.loanInvestors) {
    const dateKey = toLocalDateString(li.sentDate);
    if (
      !sentDateKeys.has(dateKey) &&
      isDateInSyncScope(dateKey, scope, todayKey)
    ) {
      sentDateKeys.add(dateKey);
      events.push({ type: "sent", dateKey });
    }
  }

  const schedule = buildLoanPaymentSchedule(loan);

  for (const due of schedule.dues) {
    if (!isDateInSyncScope(due.dateKey, scope, todayKey)) continue;
    events.push({ type: "due", dateKey: due.dateKey });
  }

  for (const interest of schedule.interests) {
    if (!isDateInSyncScope(interest.dateKey, scope, todayKey)) continue;
    events.push({ type: "interest_due", dateKey: interest.dateKey });
  }

  const seen = new Set<string>();
  return events.filter((event) => {
    const key = `${event.type}:${event.dateKey}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function uniqueSortedDateKeys(
  events: PlannedLoanCalendarEvent[],
): string[] {
  return [...new Set(events.map((event) => event.dateKey))].sort();
}

export function loansForCalendarSync(
  loans: LoanWithInvestors[],
  scope: CalendarSyncScope = "all",
  todayKey: string = manilaTodayKey(),
): LoanWithInvestors[] {
  return loans.filter((loan) => {
    if (!isLoanInSyncScope(loan, scope)) return false;
    if (scope === "upcoming") {
      return planLoanCalendarEvents(loan, scope, todayKey).length > 0;
    }
    return true;
  });
}

export function planLoansForSync(
  loans: LoanWithInvestors[],
  scope: CalendarSyncScope = "all",
  todayKey: string = manilaTodayKey(),
): PlannedLoanSync[] {
  return loansForCalendarSync(loans, scope, todayKey).map((loan) => {
    const events = planLoanCalendarEvents(loan, scope, todayKey);
    return {
      loanId: loan.id,
      loanName: loan.loanName,
      dates: uniqueSortedDateKeys(events),
      eventCount: events.length,
    };
  });
}

export function planDailySummaryDateKeys(
  loans: LoanWithInvestors[],
  scope: CalendarSyncScope = "all",
  todayKey: string = manilaTodayKey(),
): string[] {
  const keys = new Set<string>();
  for (const loan of loans) {
    for (const event of planLoanCalendarEvents(loan, scope, todayKey)) {
      keys.add(event.dateKey);
    }
  }
  return [...keys].sort();
}
