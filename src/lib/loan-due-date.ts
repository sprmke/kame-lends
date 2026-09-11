import { addDays } from "date-fns";
import {
  fromLocalDateString,
  getTodayAtMidnight,
  toLocalDateString,
} from "$lib/date-utils";

/** Inclusive window for dashboard "Maturing Soon" panels. */
export const MATURING_LOAN_WINDOW_DAYS = 14;

const MATURING_LOAN_STATUSES = new Set(["Fully Funded", "Partially Funded"]);

function dayKeyFromLocalDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/** Canonical YYYY-MM-DD for a loan due date (UTC calendar day from storage). */
export function toLoanDueDayKey(dueDate: Date | string): string {
  if (typeof dueDate === "string") {
    const datePart = dueDate.includes("T") ? dueDate.split("T")[0] : dueDate;
    if (/^\d{4}-\d{2}-\d{2}$/.test(datePart)) {
      return datePart;
    }
  }
  return toLocalDateString(dueDate);
}

function toReferenceDayKey(referenceDate?: Date): string {
  const base = referenceDate ?? getTodayAtMidnight();
  return dayKeyFromLocalDate(base);
}

function windowEndDayKey(todayKey: string, windowDays: number): string {
  const endDate = addDays(fromLocalDateString(todayKey), windowDays);
  return dayKeyFromLocalDate(endDate);
}

/** Due today through today + windowDays (inclusive), compared by calendar day. */
export function isLoanDueWithinMaturingWindow(
  dueDate: Date | string,
  windowDays = MATURING_LOAN_WINDOW_DAYS,
  referenceDate?: Date,
): boolean {
  const dueKey = toLoanDueDayKey(dueDate);
  const todayKey = toReferenceDayKey(referenceDate);
  const endKey = windowEndDayKey(todayKey, windowDays);
  return dueKey >= todayKey && dueKey <= endKey;
}

/** Calendar due date strictly before today (due today is not past due). */
export function isLoanPastDueByCalendarDate(
  dueDate: Date | string,
  referenceDate?: Date,
): boolean {
  const dueKey = toLoanDueDayKey(dueDate);
  const todayKey = toReferenceDayKey(referenceDate);
  return dueKey < todayKey;
}

export function isMaturingFundedLoan(
  loan: {
    status: string;
    dueDate: Date | string;
  },
  referenceDate?: Date,
): boolean {
  return (
    MATURING_LOAN_STATUSES.has(loan.status) &&
    isLoanDueWithinMaturingWindow(
      loan.dueDate,
      MATURING_LOAN_WINDOW_DAYS,
      referenceDate,
    )
  );
}

export function isOverdueLoanForDashboard(
  loan: {
    status: string;
    dueDate: Date | string;
  },
  referenceDate?: Date,
): boolean {
  return (
    loan.status === "Overdue" ||
    (loan.status !== "Completed" &&
      isLoanPastDueByCalendarDate(loan.dueDate, referenceDate))
  );
}
