import {
  isDateInSyncScope,
  isLoanInSyncScope,
  manilaTodayKey,
  type CalendarSyncScope,
} from "$lib/calendar-sync-plan";
import { toLocalDateString } from "$lib/date-utils";
import { buildLoanPaymentSchedule } from "$lib/loan-payment-schedule";
import type { LoanWithInvestors } from "$lib/types";

export const TOTAL_SUMMARY_PREFIX = "Total Summary";
export const SUMMARY_TITLE_PREFIXES = [
  "Total Summary",
  "Daily Summary",
] as const;

export type LoanGoogleEventType = "sent" | "due" | "interest_due";

export type LoanGoogleEventDraft = {
  key: string;
  type: LoanGoogleEventType;
  dateKey: string;
  investors: Array<{ name: string; amount: number }>;
  totalAmount: number;
  totalPrincipal?: number;
  totalInterest?: number;
  interest?: number;
};

export function nextDateKey(dateKey: string): string {
  const [year, month, day] = dateKey.split("-").map(Number);
  const next = new Date(Date.UTC(year, month - 1, day + 1));
  return `${next.getUTCFullYear()}-${String(next.getUTCMonth() + 1).padStart(2, "0")}-${String(
    next.getUTCDate(),
  ).padStart(2, "0")}`;
}

/** Google all-day events use an exclusive end date. Same-day start/end shifts the event. */
export function googleAllDayRange(dateKey: string): {
  start: { date: string };
  end: { date: string };
} {
  return {
    start: { date: dateKey },
    end: { date: nextDateKey(dateKey) },
  };
}

export function calendarEventKey(
  type: LoanGoogleEventType | "summary",
  dateKey: string,
  loanId?: number,
): string {
  if (type === "summary") return `summary-${dateKey}`;
  return `loan-${loanId}-${type}-${dateKey}`;
}

export function isSummaryEventTitle(
  summary: string | null | undefined,
): boolean {
  if (!summary) return false;
  return SUMMARY_TITLE_PREFIXES.some((prefix) => summary.startsWith(prefix));
}

export function formatCalendarCurrency(amount: number): string {
  return new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

export function totalSummaryTitle(totalAmount: number): string {
  const sign = totalAmount >= 0 ? "+" : "-";
  return `${TOTAL_SUMMARY_PREFIX} ${sign}${formatCalendarCurrency(Math.abs(totalAmount))}`;
}

export function loanGoogleEventTitle(
  type: LoanGoogleEventType,
  loanName: string,
  loanType: string,
  totalAmount: number,
): string {
  if (type === "sent") {
    return `${loanType}: ${loanName} - Disbursement (-${formatCalendarCurrency(totalAmount)})`;
  }
  if (type === "due") {
    return `${loanType}: ${loanName} - Due Date (+${formatCalendarCurrency(totalAmount)})`;
  }
  return `${loanType}: ${loanName} - Interest Due (+${formatCalendarCurrency(totalAmount)})`;
}

export function draftLoanGoogleEvents(
  loan: LoanWithInvestors,
  scope: CalendarSyncScope = "all",
  todayKey: string = manilaTodayKey(),
): LoanGoogleEventDraft[] {
  if (!isLoanInSyncScope(loan, scope)) return [];

  const drafts = new Map<string, LoanGoogleEventDraft>();

  const upsert = (draft: LoanGoogleEventDraft) => {
    const existing = drafts.get(draft.key);
    if (!existing) {
      drafts.set(draft.key, draft);
      return;
    }
    existing.totalAmount += draft.totalAmount;
    existing.investors.push(...draft.investors);
    if (draft.totalPrincipal != null) {
      existing.totalPrincipal =
        (existing.totalPrincipal ?? 0) + draft.totalPrincipal;
    }
    if (draft.totalInterest != null) {
      existing.totalInterest =
        (existing.totalInterest ?? 0) + draft.totalInterest;
    }
    if (draft.interest != null) {
      existing.interest = (existing.interest ?? 0) + draft.interest;
    }
  };

  const sentDateMap = new Map<string, Array<(typeof loan.loanInvestors)[0]>>();
  for (const li of loan.loanInvestors) {
    const dateKey = toLocalDateString(li.sentDate);
    const existing = sentDateMap.get(dateKey) ?? [];
    existing.push(li);
    sentDateMap.set(dateKey, existing);
  }

  for (const [dateKey, transactions] of sentDateMap.entries()) {
    if (!isDateInSyncScope(dateKey, scope, todayKey)) continue;
    const investors = transactions.map((row) => ({
      name: row.investor.name,
      amount: parseFloat(row.amount),
    }));
    upsert({
      key: calendarEventKey("sent", dateKey, loan.id),
      type: "sent",
      dateKey,
      investors,
      totalAmount: investors.reduce((sum, row) => sum + row.amount, 0),
    });
  }

  const schedule = buildLoanPaymentSchedule(loan);

  for (const due of schedule.dues) {
    if (!isDateInSyncScope(due.dateKey, scope, todayKey)) continue;
    upsert({
      key: calendarEventKey("due", due.dateKey, loan.id),
      type: "due",
      dateKey: due.dateKey,
      investors: due.investors,
      totalAmount: due.totalAmount,
      totalPrincipal: due.totalPrincipal,
      totalInterest: due.totalInterest,
    });
  }

  for (const interest of schedule.interests) {
    if (!isDateInSyncScope(interest.dateKey, scope, todayKey)) continue;
    upsert({
      key: calendarEventKey("interest_due", interest.dateKey, loan.id),
      type: "interest_due",
      dateKey: interest.dateKey,
      investors: [
        {
          name: interest.loanInvestor.investor.name,
          amount: interest.totalAmount,
        },
      ],
      totalAmount: interest.totalAmount,
      interest: interest.interest,
    });
  }

  return [...drafts.values()].sort((a, b) =>
    a.dateKey === b.dateKey
      ? a.type.localeCompare(b.type)
      : a.dateKey.localeCompare(b.dateKey),
  );
}
