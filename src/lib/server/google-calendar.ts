import { google } from "googleapis";
import { env } from "$env/dynamic/private";
import { resolveAppUrl } from "$lib/server/app-url";
import {
  calendarEventKey,
  draftLoanGoogleEvents,
  googleAllDayRange,
  isSummaryEventTitle,
  loanGoogleEventTitle,
  nextDateKey,
  totalSummaryTitle,
} from "$lib/calendar-events";
import {
  isDateInSyncScope,
  type CalendarSyncScope,
} from "$lib/calendar-sync-plan";
import type { LoanWithInvestors } from "$lib/types";
import { toLocalDateString } from "$lib/date-utils";
import {
  GoogleCalendarError,
  formatGoogleCalendarApiError,
  formatGoogleCalendarApiErrorWithConfig,
  readGoogleCalendarConfig,
  withGoogleCalendarRetry,
  type GoogleCalendarConfig,
} from "./google-calendar-config";

export { GoogleCalendarError } from "./google-calendar-config";

function googleCalendarEnvSource(): Record<string, string | undefined> {
  return {
    GOOGLE_SERVICE_ACCOUNT_EMAIL:
      env.GOOGLE_SERVICE_ACCOUNT_EMAIL ??
      process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
    GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY:
      env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY ??
      process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY,
    GOOGLE_CALENDAR_ID:
      env.GOOGLE_CALENDAR_ID ?? process.env.GOOGLE_CALENDAR_ID,
  };
}

function requireGoogleCalendarConfig(): GoogleCalendarConfig {
  const config = readGoogleCalendarConfig(googleCalendarEnvSource());
  if (!config) {
    throw new GoogleCalendarError(
      "Google Calendar is not configured. Set GOOGLE_SERVICE_ACCOUNT_EMAIL, GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY, and GOOGLE_CALENDAR_ID.",
    );
  }
  return config;
}

function getCalendarClient() {
  const config = requireGoogleCalendarConfig();
  const auth = new google.auth.GoogleAuth({
    credentials: {
      client_email: config.clientEmail,
      private_key: config.privateKey,
    },
    scopes: ["https://www.googleapis.com/auth/calendar"],
  });

  return {
    calendar: google.calendar({ version: "v3", auth }),
    calendarId: config.calendarId,
  };
}

function rethrowGoogleCalendarError(error: unknown): never {
  if (error instanceof GoogleCalendarError) throw error;
  const config = readGoogleCalendarConfig(googleCalendarEnvSource());
  throw new GoogleCalendarError(
    formatGoogleCalendarApiErrorWithConfig(error, config),
  );
}

let lastMutationAt = 0;
const MUTATION_GAP_MS = 120;

async function spaceCalendarMutations(): Promise<void> {
  const wait = lastMutationAt + MUTATION_GAP_MS - Date.now();
  if (wait > 0) {
    await new Promise((resolve) => setTimeout(resolve, wait));
  }
  lastMutationAt = Date.now();
}

async function calendarMutation<T>(operation: () => Promise<T>): Promise<T> {
  await spaceCalendarMutations();
  return withGoogleCalendarRetry(operation);
}

interface CalendarEventData {
  type: "sent" | "due" | "interest_due" | "summary";
  date: Date;
  dateKey?: string;
  loan?: LoanWithInvestors;
  loans?: LoanWithInvestors[];
  loanAmounts?: Map<number, { amount: number; isOut: boolean }>; // loan ID -> amount for this specific day
  investors?: Array<{ name: string; amount: number }>;
  totalAmount?: number;
  totalPrincipal?: number;
  totalInterest?: number;
  investorName?: string;
  principal?: number;
  interest?: number;
  loanInvestorId?: number;
  interestPeriodId?: number;
  direction?: "in" | "out";
  loanCount?: number;
}

function eventDateKey(eventData: CalendarEventData): string {
  return eventData.dateKey ?? toLocalDateString(eventData.date);
}

function eventPrivateKey(eventData: CalendarEventData): string {
  const dateKey = eventDateKey(eventData);
  if (eventData.type === "summary") return calendarEventKey("summary", dateKey);
  return calendarEventKey(eventData.type, dateKey, eventData.loan?.id);
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

function createEventDescription(eventData: CalendarEventData): string {
  const {
    type,
    loan,
    loans,
    loanAmounts,
    investors,
    totalAmount,
    totalPrincipal,
    totalInterest,
    investorName,
    interest,
  } = eventData;

  const appUrl = resolveAppUrl();

  let description = "";

  if (type === "summary") {
    if (loans && loans.length > 0 && loanAmounts) {
      description += `Loans:\n`;
      loans.forEach((l) => {
        const loanData = loanAmounts.get(l.id);
        if (loanData) {
          const sign = loanData.isOut ? "-" : "+";
          description += `  • ${l.loanName}: ${sign}${formatCurrency(Math.abs(loanData.amount))}\n`;
        }
      });
      description += `\n`;
    }

    // Use HTML-style bold for better compatibility with + or - sign
    const sign = (totalAmount || 0) >= 0 ? "+" : "-";
    description += `<b>Total: ${sign}${formatCurrency(Math.abs(totalAmount || 0))}</b>\n`;

    // Add date parameter to the loans link for filtering
    const dateStr = eventDateKey(eventData);
    description += `\n<a href="${appUrl}/loans?dueDate=${dateStr}">View Loans</a>`;
  } else if (loan) {
    const loanUrl = `${appUrl}/loans/${loan.id}`;

    description = `Loan: ${loan.loanName}\n`;
    description += `Type: ${loan.type}\n`;
    description += `Status: ${loan.status}\n\n`;

    if (type === "sent") {
      description += `Investors:\n`;
      investors?.forEach((inv) => {
        description += `  • ${inv.name}: -${formatCurrency(inv.amount)}\n`;
      });
      description += `\n<b>Total: -${formatCurrency(totalAmount || 0)}</b>\n`;
    } else if (type === "due") {
      if (investors && investors.length > 0) {
        description += `Investors:\n`;
        investors.forEach((inv) => {
          description += `  • ${inv.name}: +${formatCurrency(inv.amount)}\n`;
        });
      } else if (investorName) {
        description += `Investor: ${investorName}\n`;
      }
      description += `Principal: +${formatCurrency(totalPrincipal || 0)}\n`;
      description += `Interest: +${formatCurrency(totalInterest || 0)}\n`;
      description += `\n<b>Total: +${formatCurrency(totalAmount || 0)}</b>\n`;
    } else if (type === "interest_due") {
      if (investors && investors.length > 0) {
        description += `Investors:\n`;
        investors.forEach((inv) => {
          description += `  • ${inv.name}: +${formatCurrency(inv.amount)}\n`;
        });
      } else if (investorName) {
        description += `Investor: ${investorName}\n`;
      }
      description += `\n<b>Total: +${formatCurrency(interest || 0)}</b>\n`;
    }

    if (loan.notes) {
      description += `\nNotes: ${loan.notes}`;
    }

    description += `\n\n<a href="${loanUrl}">View Loan Details</a>`;
  }

  return description;
}

function createEventSummary(eventData: CalendarEventData): string {
  const { type, loan, totalAmount } = eventData;

  if (type === "summary") {
    return totalSummaryTitle(totalAmount || 0);
  }
  if (loan) {
    return loanGoogleEventTitle(
      type,
      loan.loanName,
      loan.type,
      type === "interest_due" ? eventData.interest || 0 : totalAmount || 0,
    );
  }

  return "Event";
}

function googleEventRequestBody(eventData: CalendarEventData) {
  const dateKey = eventDateKey(eventData);
  const range = googleAllDayRange(dateKey);
  return {
    summary: createEventSummary(eventData),
    description: createEventDescription(eventData),
    start: range.start,
    end: range.end,
    colorId: getEventColor(eventData.type),
    reminders: {
      useDefault: false,
      overrides: [
        { method: "email", minutes: 24 * 60 },
        { method: "popup", minutes: 60 },
      ],
    },
    extendedProperties: {
      private: {
        kameKey: eventPrivateKey(eventData),
        kameKind: eventData.type,
        kameDate: dateKey,
      },
    },
  };
}

function getEventColor(
  type: "sent" | "due" | "interest_due" | "summary",
): string {
  // Google Calendar color IDs
  // 11 = Red (for sent/disbursement)
  // 2 = Sage/Light Green (for due date)
  // 7 = Peacock/Light Blue (for interest due)
  // 8 = Graphite (for daily summary)
  switch (type) {
    case "sent":
      return "11"; // Red
    case "due":
      return "2"; // Sage (light green)
    case "interest_due":
      return "7"; // Peacock (light blue)
    case "summary":
      return "8"; // Graphite
    default:
      return "1"; // Default
  }
}

export async function createCalendarEvent(
  eventData: CalendarEventData,
): Promise<string> {
  try {
    const { calendar, calendarId } = getCalendarClient();
    const event = googleEventRequestBody(eventData);

    const response = await calendarMutation(() =>
      calendar.events.insert({
        calendarId,
        requestBody: event,
        sendUpdates: "none", // Don't send email notifications (requires Domain-Wide Delegation)
      }),
    );

    if (!response.data.id) {
      throw new GoogleCalendarError(
        "Google Calendar did not return an event id",
      );
    }

    console.log("Calendar event created:", response.data.id);
    return response.data.id;
  } catch (error) {
    console.error("Error creating calendar event:", error);
    rethrowGoogleCalendarError(error);
  }
}

export async function updateCalendarEvent(
  eventId: string,
  eventData: CalendarEventData,
): Promise<boolean> {
  try {
    const { calendar, calendarId } = getCalendarClient();
    const event = googleEventRequestBody(eventData);

    await calendarMutation(() =>
      calendar.events.update({
        calendarId,
        eventId,
        requestBody: event,
        sendUpdates: "none", // Don't send email notifications (requires Domain-Wide Delegation)
      }),
    );

    console.log("Calendar event updated:", eventId);
    return true;
  } catch (error) {
    console.error("Error updating calendar event:", error);
    rethrowGoogleCalendarError(error);
  }
}

export async function deleteCalendarEvent(eventId: string): Promise<boolean> {
  try {
    const { calendar, calendarId } = getCalendarClient();

    await calendarMutation(() =>
      calendar.events.delete({
        calendarId,
        eventId,
        sendUpdates: "none", // Don't send cancellation notifications (requires Domain-Wide Delegation)
      }),
    );

    console.log("Calendar event deleted:", eventId);
    return true;
  } catch (error) {
    const message = formatGoogleCalendarApiError(error);
    if (/notFound|\b404\b/i.test(message)) {
      console.warn("Calendar event already gone:", eventId);
      return false;
    }
    console.error("Error deleting calendar event:", error);
    rethrowGoogleCalendarError(error);
  }
}

export async function deleteMultipleCalendarEvents(
  eventIds: string[],
): Promise<void> {
  if (!eventIds || eventIds.length === 0) return;

  for (const eventId of eventIds) {
    await deleteCalendarEvent(eventId);
  }
}

// Delete ALL events from Google Calendar (complete cleanup for fresh start)
export async function deleteCalendarEventBatch(
  maxDeletes = 20,
): Promise<{ deleted: number; remaining: boolean }> {
  try {
    const { calendar, calendarId } = getCalendarClient();
    const response = await withGoogleCalendarRetry(() =>
      calendar.events.list({
        calendarId,
        maxResults: maxDeletes,
        singleEvents: true,
      }),
    );

    const events = response.data.items || [];
    let deleted = 0;
    for (const event of events) {
      if (!event.id) continue;
      const ok = await deleteCalendarEvent(event.id);
      if (ok) deleted++;
    }

    return {
      deleted,
      remaining: deleted > 0 && events.length >= maxDeletes,
    };
  } catch (error) {
    console.error("Error deleting calendar event batch:", error);
    rethrowGoogleCalendarError(error);
  }
}

export async function deleteAllCalendarEvents(): Promise<number> {
  let deletedCount = 0;
  let remaining = true;
  while (remaining) {
    const batch = await deleteCalendarEventBatch(20);
    deletedCount += batch.deleted;
    remaining = batch.remaining;
    if (batch.deleted === 0) break;
  }
  return deletedCount;
}

function dateFromDateKey(dateKey: string): Date {
  return new Date(`${dateKey}T00:00:00.000Z`);
}

async function findEventsByPrivateKey(kameKey: string): Promise<string[]> {
  const { calendar, calendarId } = getCalendarClient();
  const response = await withGoogleCalendarRetry(() =>
    calendar.events.list({
      calendarId,
      privateExtendedProperty: [`kameKey=${kameKey}`],
      maxResults: 50,
      singleEvents: true,
    }),
  );
  return (response.data.items ?? [])
    .map((event) => event.id)
    .filter((id): id is string => Boolean(id));
}

async function findSummaryEventIdsOnDate(dateKey: string): Promise<string[]> {
  const { calendar, calendarId } = getCalendarClient();
  const response = await withGoogleCalendarRetry(() =>
    calendar.events.list({
      calendarId,
      timeMin: `${dateKey}T00:00:00Z`,
      timeMax: `${nextDateKey(dateKey)}T00:00:00Z`,
      singleEvents: true,
      maxResults: 50,
    }),
  );
  return (response.data.items ?? [])
    .filter((event) => isSummaryEventTitle(event.summary))
    .map((event) => event.id)
    .filter((id): id is string => Boolean(id));
}

async function upsertCalendarEvent(
  eventData: CalendarEventData,
): Promise<string> {
  const ids = new Set(await findEventsByPrivateKey(eventPrivateKey(eventData)));
  if (eventData.type === "summary") {
    for (const id of await findSummaryEventIdsOnDate(eventDateKey(eventData))) {
      ids.add(id);
    }
  }
  const [keepId, ...extras] = [...ids];
  for (const extra of extras) {
    await deleteCalendarEvent(extra);
  }
  if (keepId) {
    await updateCalendarEvent(keepId, eventData);
    return keepId;
  }
  return createCalendarEvent(eventData);
}

// Generate or update daily summary events for specific dates
// This should be called after adding/updating/deleting a loan
export async function updateDailySummaryEvents(
  affectedDates: Date[],
  allLoans: LoanWithInvestors[],
): Promise<void> {
  try {
    requireGoogleCalendarConfig();

    // Group events by date and track amounts per loan per day
    const dailyEvents = new Map<
      string,
      {
        out: { loans: LoanWithInvestors[]; amount: number };
        in: { loans: LoanWithInvestors[]; amount: number };
        loanAmounts: Map<number, { amount: number; isOut: boolean }>;
      }
    >();

    // Initialize the map for affected dates
    for (const date of affectedDates) {
      const dateKey = toLocalDateString(date);
      dailyEvents.set(dateKey, {
        out: { loans: [], amount: 0 },
        in: { loans: [], amount: 0 },
        loanAmounts: new Map(),
      });
    }

    // Process all loans to calculate totals for affected dates
    for (const loan of allLoans) {
      // Process sent dates (OUT)
      const sentDateMap = new Map<string, number>();
      loan.loanInvestors.forEach((li) => {
        const dateKey = toLocalDateString(li.sentDate);
        const amount = parseFloat(li.amount);
        sentDateMap.set(dateKey, (sentDateMap.get(dateKey) || 0) + amount);
      });

      for (const [dateKey, amount] of sentDateMap.entries()) {
        if (!dailyEvents.has(dateKey)) continue; // Only process affected dates

        const dayData = dailyEvents.get(dateKey)!;
        if (!dayData.out.loans.find((l) => l.id === loan.id)) {
          dayData.out.loans.push(loan);
        }
        dayData.out.amount += amount;

        // Track this loan's OUT amount for this day
        const existing = dayData.loanAmounts.get(loan.id);
        if (existing) {
          existing.amount -= amount; // Subtract OUT amount
        } else {
          dayData.loanAmounts.set(loan.id, { amount: -amount, isOut: true });
        }
      }

      // Process due dates (IN)
      const hasAnyMultipleInterest = loan.loanInvestors.some(
        (li) =>
          li.hasMultipleInterest &&
          li.interestPeriods &&
          li.interestPeriods.length > 0,
      );

      if (hasAnyMultipleInterest) {
        // Process interest periods
        for (const li of loan.loanInvestors) {
          if (
            li.hasMultipleInterest &&
            li.interestPeriods &&
            li.interestPeriods.length > 0
          ) {
            // Sort periods by due date to find the last one
            const sortedPeriods = [...li.interestPeriods].sort(
              (a, b) =>
                new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime(),
            );

            for (let i = 0; i < sortedPeriods.length; i++) {
              const period = sortedPeriods[i];
              const isLastPeriod = i === sortedPeriods.length - 1;
              const dateKey = toLocalDateString(period.dueDate);

              if (!dailyEvents.has(dateKey)) continue; // Only process affected dates

              const principal = parseFloat(li.amount);
              let interest = 0;
              if (period.interestType === "rate") {
                const rate = parseFloat(period.interestRate) / 100;
                interest = principal * rate;
              } else {
                interest = parseFloat(period.interestRate);
              }

              // Last period: principal + interest, Other periods: interest only
              const totalAmount = isLastPeriod
                ? principal + interest
                : interest;

              const dayData = dailyEvents.get(dateKey)!;
              if (!dayData.in.loans.find((l) => l.id === loan.id)) {
                dayData.in.loans.push(loan);
              }
              dayData.in.amount += totalAmount;

              // Track this loan's IN amount for this day
              const existing = dayData.loanAmounts.get(loan.id);
              if (existing) {
                existing.amount += totalAmount; // Add IN amount
                existing.isOut = existing.amount < 0;
              } else {
                dayData.loanAmounts.set(loan.id, {
                  amount: totalAmount,
                  isOut: false,
                });
              }
            }
          }
        }
      } else {
        // Process single due date
        const dateKey = toLocalDateString(loan.dueDate);

        if (!dailyEvents.has(dateKey)) continue; // Only process affected dates

        const totalPrincipal = loan.loanInvestors.reduce(
          (sum, li) => sum + parseFloat(li.amount),
          0,
        );
        const totalInterest = loan.loanInvestors.reduce((sum, li) => {
          const capital = parseFloat(li.amount);
          if (li.interestType === "rate") {
            const rate = parseFloat(li.interestRate) / 100;
            return sum + capital * rate;
          } else {
            return sum + parseFloat(li.interestRate);
          }
        }, 0);
        const totalAmount = totalPrincipal + totalInterest;

        const dayData = dailyEvents.get(dateKey)!;
        if (!dayData.in.loans.find((l) => l.id === loan.id)) {
          dayData.in.loans.push(loan);
        }
        dayData.in.amount += totalAmount;

        // Track this loan's IN amount for this day
        const existing = dayData.loanAmounts.get(loan.id);
        if (existing) {
          existing.amount += totalAmount; // Add IN amount
          existing.isOut = existing.amount < 0;
        } else {
          dayData.loanAmounts.set(loan.id, {
            amount: totalAmount,
            isOut: false,
          });
        }
      }
    }

    // Create or update summary events for affected dates
    for (const [dateKey, dayData] of dailyEvents.entries()) {
      const allLoansForDay = [...dayData.out.loans, ...dayData.in.loans];
      const uniqueLoans = Array.from(
        new Map(allLoansForDay.map((l) => [l.id, l])).values(),
      );

      let totalAmount = 0;
      if (dayData.in.amount > 0 && dayData.out.amount > 0) {
        totalAmount = dayData.in.amount - dayData.out.amount;
      } else if (dayData.in.amount > 0) {
        totalAmount = dayData.in.amount;
      } else {
        totalAmount = -dayData.out.amount;
      }

      if (uniqueLoans.length > 0) {
        await upsertCalendarEvent({
          type: "summary",
          date: dateFromDateKey(dateKey),
          dateKey,
          loans: uniqueLoans,
          loanAmounts: dayData.loanAmounts,
          totalAmount,
          loanCount: uniqueLoans.length,
        });
      } else {
        for (const eventId of await findSummaryEventIdsOnDate(dateKey)) {
          await deleteCalendarEvent(eventId);
        }
      }
    }
  } catch (error) {
    console.error("Error updating daily summary events:", error);
    rethrowGoogleCalendarError(error);
  }
}

// Get all dates affected by a loan (sent dates and due dates)
export function getAffectedDatesFromLoan(loan: LoanWithInvestors): Date[] {
  const dates: Date[] = [];
  const dateSet = new Set<string>();

  // Add sent dates
  loan.loanInvestors.forEach((li) => {
    const dateKey = toLocalDateString(li.sentDate);
    if (!dateSet.has(dateKey)) {
      dateSet.add(dateKey);
      dates.push(new Date(li.sentDate));
    }
  });

  // Check if loan has multiple interest dates
  const hasAnyMultipleInterest = loan.loanInvestors.some(
    (li) =>
      li.hasMultipleInterest &&
      li.interestPeriods &&
      li.interestPeriods.length > 0,
  );

  if (hasAnyMultipleInterest) {
    // Add interest period due dates
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
    // Add single due date
    const dateKey = toLocalDateString(loan.dueDate);
    if (!dateSet.has(dateKey)) {
      dateSet.add(dateKey);
      dates.push(new Date(loan.dueDate));
    }
  }

  return dates;
}

export type GenerateCalendarEventsOptions = {
  scope?: CalendarSyncScope;
  todayKey?: string;
};

function includeEventDate(
  date: Date | string,
  options: GenerateCalendarEventsOptions = {},
): boolean {
  return isDateInSyncScope(date, options.scope ?? "all", options.todayKey);
}

// Generate calendar events for a loan (individual events only, no summaries)
export async function generateLoanCalendarEvents(
  loan: LoanWithInvestors,
  options: GenerateCalendarEventsOptions = {},
): Promise<string[]> {
  const drafts = draftLoanGoogleEvents(
    loan,
    options.scope ?? "all",
    options.todayKey,
  );
  const eventIds: string[] = [];

  try {
    for (const draft of drafts) {
      const eventId = await upsertCalendarEvent({
        type: draft.type,
        date: dateFromDateKey(draft.dateKey),
        dateKey: draft.dateKey,
        loan,
        investors: draft.investors,
        totalAmount: draft.totalAmount,
        totalPrincipal: draft.totalPrincipal,
        totalInterest: draft.totalInterest,
        interest: draft.interest,
      });
      if (eventId) eventIds.push(eventId);
    }
  } catch (error) {
    console.error("Error generating loan calendar events:", error);
    rethrowGoogleCalendarError(error);
  }

  return eventIds;
}

export type DailySummaryDay = {
  out: { loans: LoanWithInvestors[]; amount: number };
  in: { loans: LoanWithInvestors[]; amount: number };
  loanAmounts: Map<number, { amount: number; isOut: boolean }>;
};

/** Pure daily cash-flow rollup used by workspace and per-group calendars. */
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

async function createSummaryEventsForDays(
  dailyEvents: Map<string, DailySummaryDay>,
  dateKeys: string[],
): Promise<number> {
  let created = 0;
  for (const dateKey of dateKeys) {
    const dayData = dailyEvents.get(dateKey);
    if (!dayData) continue;
    const allLoans = [...dayData.out.loans, ...dayData.in.loans];
    const uniqueLoans = Array.from(
      new Map(allLoans.map((l) => [l.id, l])).values(),
    );

    const totalAmount =
      dayData.in.amount > 0 && dayData.out.amount > 0
        ? dayData.in.amount - dayData.out.amount
        : dayData.in.amount > 0
          ? dayData.in.amount
          : -dayData.out.amount;

    if (uniqueLoans.length === 0) continue;
    const eventId = await upsertCalendarEvent({
      type: "summary",
      date: dateFromDateKey(dateKey),
      dateKey,
      loans: uniqueLoans,
      loanAmounts: dayData.loanAmounts,
      totalAmount,
      loanCount: uniqueLoans.length,
    });
    if (eventId) created++;
  }
  return created;
}

export async function generateDailySummaryEvents(
  loans: LoanWithInvestors[],
  dateKeys: string[],
): Promise<{ created: number; dates: string[] }> {
  if (dateKeys.length === 0) return { created: 0, dates: [] };
  requireGoogleCalendarConfig();
  const dailyEvents = collectDailySummaryDays(loans);
  const created = await createSummaryEventsForDays(dailyEvents, dateKeys);
  return { created, dates: dateKeys };
}

// Generate calendar events for multiple loans with daily summaries
// This is ONLY used for initial sync or bulk operations
export async function generateAllLoansCalendarEvents(
  loans: LoanWithInvestors[],
  options: GenerateCalendarEventsOptions = {},
): Promise<Map<number, string[]>> {
  const loanEventIds = new Map<number, string[]>();

  try {
    requireGoogleCalendarConfig();

    for (const loan of loans) {
      const eventIds = await generateLoanCalendarEvents(loan, options);
      loanEventIds.set(loan.id, eventIds);
    }

    const dailyEvents = collectDailySummaryDays(loans);
    const dateKeys = [...dailyEvents.keys()]
      .filter((dateKey) => includeEventDate(dateKey, options))
      .sort();
    await createSummaryEventsForDays(dailyEvents, dateKeys);
  } catch (error) {
    console.error("Error generating all loans calendar events:", error);
    rethrowGoogleCalendarError(error);
  }

  return loanEventIds;
}
