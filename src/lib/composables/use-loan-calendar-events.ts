import { toLocalDateString } from "$lib/date-utils";
import { buildLoanPaymentSchedule } from "$lib/loan-payment-schedule";
import type { LoanWithInvestors } from "$lib/types";
import type {
  CalendarEvent,
  CalendarEventDue,
  CalendarEventInterestDue,
  CalendarEventSent,
} from "$lib/components/common/calendar/types";

const SHORT_MONTHS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
] as const;

export type CalendarSentInvestorLine = {
  name: string;
  amount: number;
  /** Set when this disbursement is on a different calendar day than the event. */
  note?: string;
};

function calendarDayKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function shortCalendarDate(dateKey: string): string {
  const [, month, day] = dateKey.split("-").map(Number);
  return `${SHORT_MONTHS[(month ?? 1) - 1] ?? ""} ${day ?? ""}`;
}

/**
 * Calendar cells list only the lenders who sent money that day.
 * The day events modal lists every lender on the loan so a co-investor
 * with a different sent date is still visible. The card total stays the day's cash.
 */
export function sentInvestorLinesForCard(
  event: CalendarEventSent,
  forModal: boolean,
): CalendarSentInvestorLine[] {
  const dayLines = event.investors.map((investor) => ({
    name: investor.name,
    amount: investor.amount,
  }));
  if (!forModal) return dayLines;

  const rows = event.loan.loanInvestors ?? [];
  if (rows.length === 0) return dayLines;

  const dayKey = calendarDayKey(event.date);
  const lines = rows.map((row) => {
    const sentKey = toLocalDateString(row.sentDate);
    const onThisDay = sentKey === dayKey;
    return {
      name: row.investor.name,
      amount: parseFloat(row.amount),
      note: onThisDay ? undefined : shortCalendarDate(sentKey),
    };
  });
  return lines.sort(
    (a, b) => Number(Boolean(a.note)) - Number(Boolean(b.note)),
  );
}

export function buildLoanCalendarEvents(
  loans: LoanWithInvestors[],
): CalendarEvent[] {
  const events: CalendarEvent[] = [];

  loans.forEach((loan) => {
    const sentDateMap = new Map<
      string,
      Array<(typeof loan.loanInvestors)[0]>
    >();

    loan.loanInvestors.forEach((li) => {
      const dateKey = toLocalDateString(li.sentDate);
      const existing = sentDateMap.get(dateKey) || [];
      existing.push(li);
      sentDateMap.set(dateKey, existing);
    });

    sentDateMap.forEach((transactions, dateKey) => {
      const investors = transactions.map((t) => ({
        name: t.investor.name,
        amount: parseFloat(t.amount),
      }));
      const totalAmount = investors.reduce((sum, inv) => sum + inv.amount, 0);
      const hasUnpaidTransactions = transactions.some((t) => !t.isPaid);

      events.push({
        type: "sent",
        loan,
        date: new Date(`${dateKey}T00:00:00`),
        investors,
        totalAmount,
        hasUnpaidTransactions,
      } satisfies CalendarEventSent);
    });

    const schedule = buildLoanPaymentSchedule(loan);

    schedule.dues.forEach((due) => {
      events.push({
        type: "due",
        loan,
        date: due.date,
        totalPrincipal: due.totalPrincipal,
        totalInterest: due.totalInterest,
        totalAmount: due.totalAmount,
      } satisfies CalendarEventDue);
    });

    schedule.interests.forEach((interest) => {
      events.push({
        type: "interest_due",
        loan,
        loanInvestor: interest.loanInvestor,
        interestPeriod: interest.interestPeriod,
        date: interest.date,
        principal: interest.principal,
        interest: interest.interest,
        totalAmount: interest.totalAmount,
      } satisfies CalendarEventInterestDue);
    });
  });

  return events;
}
