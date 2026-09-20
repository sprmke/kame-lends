import { google, type calendar_v3 } from "googleapis";
import { env } from "$env/dynamic/private";
import { db } from "$lib/server/db";
import {
  groupCalendars,
  loanGroups,
  loanGroupLoans,
  loanGroupMembers,
  loans as loansTable,
  users,
} from "$lib/server/db/schema";
import { eq, inArray } from "drizzle-orm";
import { normalizeEmail } from "$lib/loan-signing";
import { diffCalendarAcl } from "$lib/calendar-acl-diff";
import {
  GoogleCalendarError,
  formatGoogleCalendarApiError,
  isGoogleCalendarNotFoundError,
  readGoogleServiceAccountCredentials,
  withGoogleCalendarRetry,
} from "$lib/server/google-calendar-config";
import { enqueueJob } from "$lib/server/jobs/queue";
import {
  collectDailySummaryDays,
  getAffectedDatesFromLoan,
} from "$lib/calendar-summaries";
import type { LoanWithInvestors } from "$lib/types";
import { resolveAppUrl } from "$lib/server/app-url";
import {
  googleCalendarColorIdForKind,
  type GoogleCalendarLoanEventKind,
} from "$lib/calendar-event-colors";
import {
  duplicateIdsForSameKey,
  planLoanCalendarEventDeletions,
  planSummaryCalendarEventDeletions,
} from "$lib/calendar-google-dedupe";

function creds() {
  return readGoogleServiceAccountCredentials({
    GOOGLE_SERVICE_ACCOUNT_EMAIL:
      env.GOOGLE_SERVICE_ACCOUNT_EMAIL ??
      process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
    GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY:
      env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY ??
      process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY,
  });
}

type CalendarClient = calendar_v3.Calendar;

let memoized: { email: string; calendar: CalendarClient } | null = null;

function getGroupCalendarApi(): {
  calendar: CalendarClient;
  clientEmail: string;
} {
  const credentials = creds();
  if (!credentials) {
    throw new GoogleCalendarError(
      "Google Calendar service account is not configured.",
    );
  }
  if (memoized && memoized.email === credentials.clientEmail) {
    return {
      calendar: memoized.calendar,
      clientEmail: credentials.clientEmail,
    };
  }
  const auth = new google.auth.GoogleAuth({
    credentials: {
      client_email: credentials.clientEmail,
      private_key: credentials.privateKey,
    },
    scopes: ["https://www.googleapis.com/auth/calendar"],
  });
  const calendar = google.calendar({ version: "v3", auth });
  memoized = { email: credentials.clientEmail, calendar };
  return { calendar, clientEmail: credentials.clientEmail };
}

async function mutate<T>(op: () => Promise<T>): Promise<T> {
  return withGoogleCalendarRetry(op);
}

async function deleteCalendarEvents(
  calendarId: string,
  eventIds: string[],
): Promise<void> {
  if (eventIds.length === 0) return;
  const { calendar } = getGroupCalendarApi();
  for (const eventId of eventIds) {
    await mutate(() => calendar.events.delete({ calendarId, eventId }));
  }
}

export function groupCalendarSubscribeUrl(googleCalendarId: string): string {
  return `https://calendar.google.com/calendar/r?cid=${encodeURIComponent(googleCalendarId)}`;
}

export async function provisionGroupCalendar(groupId: number): Promise<void> {
  const group = await db.query.loanGroups.findFirst({
    where: eq(loanGroups.id, groupId),
  });
  if (!group) return;

  const existing = await db.query.groupCalendars.findFirst({
    where: eq(groupCalendars.groupId, groupId),
  });

  const renameOnly = false;
  const { calendar, clientEmail } = getGroupCalendarApi();

  if (existing?.googleCalendarId) {
    try {
      await mutate(() =>
        calendar.calendars.patch({
          calendarId: existing.googleCalendarId!,
          requestBody: {
            summary: `Kame Lends · ${group.name}`,
            description: group.notes ?? undefined,
          },
        }),
      );
      await db
        .update(groupCalendars)
        .set({
          status: "active",
          lastError: null,
          updatedAt: new Date(),
        })
        .where(eq(groupCalendars.groupId, groupId));
      if (!renameOnly) {
        await enqueueJob({
          kind: "group.calendar.acl",
          groupId,
          dedupeKey: `group.calendar.acl:${groupId}`,
        });
      }
      return;
    } catch (error) {
      if (!isGoogleCalendarNotFoundError(error)) {
        await db
          .update(groupCalendars)
          .set({
            status: "error",
            lastError: formatGoogleCalendarApiError(error),
            updatedAt: new Date(),
          })
          .where(eq(groupCalendars.groupId, groupId));
        throw error;
      }
      await db
        .update(groupCalendars)
        .set({ googleCalendarId: null, status: "provisioning" })
        .where(eq(groupCalendars.groupId, groupId));
    }
  }

  await db
    .insert(groupCalendars)
    .values({ groupId, status: "provisioning" })
    .onConflictDoNothing();

  try {
    const created = await mutate(() =>
      calendar.calendars.insert({
        requestBody: {
          summary: `Kame Lends · ${group.name}`,
          description:
            group.notes ??
            `Shared loan calendar for ${group.name}. Managed by ${clientEmail}.`,
          timeZone: "Asia/Manila",
        },
      }),
    );
    const googleCalendarId = created.data.id;
    if (!googleCalendarId) {
      throw new GoogleCalendarError("Calendar insert returned no id");
    }

    await db
      .update(groupCalendars)
      .set({
        googleCalendarId,
        status: "active",
        lastError: null,
        updatedAt: new Date(),
      })
      .where(eq(groupCalendars.groupId, groupId));

    await enqueueJob({
      kind: "group.calendar.acl",
      groupId,
      dedupeKey: `group.calendar.acl:${groupId}`,
    });

    const loanRows = await db
      .select({ loanId: loanGroupLoans.loanId })
      .from(loanGroupLoans)
      .where(eq(loanGroupLoans.groupId, groupId));
    for (const { loanId } of loanRows) {
      await enqueueJob({
        kind: "group.calendar.syncLoan",
        groupId,
        payload: { loanId },
        dedupeKey: `group.calendar.syncLoan:${groupId}:${loanId}`,
      });
    }
  } catch (error) {
    await db
      .update(groupCalendars)
      .set({
        status: "error",
        lastError: formatGoogleCalendarApiError(error),
        updatedAt: new Date(),
      })
      .where(eq(groupCalendars.groupId, groupId));
    throw error;
  }
}

export async function reconcileGroupCalendarAcl(
  groupId: number,
): Promise<void> {
  const row = await db.query.groupCalendars.findFirst({
    where: eq(groupCalendars.groupId, groupId),
  });
  if (!row?.googleCalendarId) {
    await provisionGroupCalendar(groupId);
    return;
  }

  const { calendar, clientEmail } = getGroupCalendarApi();
  const members = await db
    .select({ email: users.email })
    .from(loanGroupMembers)
    .innerJoin(users, eq(users.id, loanGroupMembers.userId))
    .where(eq(loanGroupMembers.groupId, groupId));

  const desiredEmails = members
    .map((m) => normalizeEmail(m.email))
    .filter((e): e is string => Boolean(e));

  const aclList = await mutate(() =>
    calendar.acl.list({ calendarId: row.googleCalendarId! }),
  );
  const actualRules = (aclList.data.items ?? [])
    .filter((item) => item.scope?.type === "user" && item.scope.value)
    .map((item) => ({
      ruleId: item.id ?? undefined,
      email: item.scope!.value!,
      role: item.role ?? "reader",
    }));

  const { toInsert, toDelete } = diffCalendarAcl({
    desiredEmails,
    actualRules,
    serviceAccountEmail: clientEmail,
  });

  for (const email of toInsert) {
    await mutate(() =>
      calendar.acl.insert({
        calendarId: row.googleCalendarId!,
        sendNotifications: true,
        requestBody: {
          role: "reader",
          scope: { type: "user", value: email },
        },
      }),
    );
  }
  for (const rule of toDelete) {
    if (!rule.ruleId) continue;
    await mutate(() =>
      calendar.acl.delete({
        calendarId: row.googleCalendarId!,
        ruleId: rule.ruleId!,
      }),
    );
  }

  await db
    .update(groupCalendars)
    .set({ lastAclSyncAt: new Date(), lastError: null, updatedAt: new Date() })
    .where(eq(groupCalendars.groupId, groupId));
}

async function loadLoanForCalendar(
  loanId: number,
): Promise<LoanWithInvestors | null> {
  const loan = await db.query.loans.findFirst({
    where: (table, { eq: e }) => e(table.id, loanId),
    with: {
      borrower: true,
      loanInvestors: {
        with: {
          investor: true,
          interestPeriods: true,
          receivedPayments: true,
        },
      },
      loanWitnesses: { with: { witness: true } },
    },
  });
  return (loan as LoanWithInvestors | undefined) ?? null;
}

export async function syncGroupLoanEvents(
  groupId: number,
  loanId: number,
): Promise<void> {
  const row = await db.query.groupCalendars.findFirst({
    where: eq(groupCalendars.groupId, groupId),
  });
  if (!row?.googleCalendarId) {
    await provisionGroupCalendar(groupId);
    return syncGroupLoanEvents(groupId, loanId);
  }

  const loan = await loadLoanForCalendar(loanId);
  if (!loan) return;

  await syncLoanEventsToCalendar(row.googleCalendarId, loan);

  const dates = getAffectedDatesFromLoan(loan);
  const dateKeys = dates.map((d) => {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  });
  await enqueueJob({
    kind: "group.calendar.summaries",
    groupId,
    payload: { dateKeys },
    dedupeKey: `group.calendar.summaries:${groupId}:${dateKeys.sort().join(",")}`,
  });

  await db
    .update(groupCalendars)
    .set({ lastEventSyncAt: new Date(), updatedAt: new Date() })
    .where(eq(groupCalendars.groupId, groupId));
}

async function syncLoanEventsToCalendar(
  calendarId: string,
  loan: LoanWithInvestors,
): Promise<void> {
  const { calendar } = getGroupCalendarApi();
  const { draftLoanGoogleEvents, googleAllDayRange, loanGoogleEventTitle } =
    await import("$lib/calendar-events");
  const drafts = draftLoanGoogleEvents(loan, "all");
  const appUrl = resolveAppUrl();
  const currentKeys = new Set(drafts.map((d) => d.key));

  for (const draft of drafts) {
    const key = draft.key;
    const range = googleAllDayRange(draft.dateKey);
    const summary = loanGoogleEventTitle(
      draft.type,
      loan.loanName,
      loan.type,
      draft.totalAmount,
    );
    const description = `Open in Kame Lends: ${appUrl}/loans/${loan.id}`;

    const existing = await findEventsByLoanId(calendarId, loan.id, key);
    const body: calendar_v3.Schema$Event = {
      summary,
      description,
      start: range.start,
      end: range.end,
      colorId: googleCalendarColorIdForKind(
        draft.type as GoogleCalendarLoanEventKind,
      ),
      extendedProperties: {
        private: {
          kameKey: key,
          kameLoanId: String(loan.id),
          kameKind: draft.type,
        },
      },
    };

    let keepEventId = existing[0]?.id ?? undefined;
    if (keepEventId) {
      await mutate(() =>
        calendar.events.patch({
          calendarId,
          eventId: keepEventId!,
          requestBody: body,
        }),
      );
    } else {
      const created = await mutate(() =>
        calendar.events.insert({
          calendarId,
          requestBody: body,
        }),
      );
      keepEventId = created.data.id ?? undefined;
    }
    await deleteCalendarEvents(
      calendarId,
      duplicateIdsForSameKey(existing, keepEventId),
    );
  }

  const existingForLoan = await findEventsByLoanId(calendarId, loan.id);
  await deleteCalendarEvents(
    calendarId,
    planLoanCalendarEventDeletions(
      existingForLoan,
      currentKeys,
      loan.id,
      drafts,
    ),
  );
}

export async function findEventsByLoanId(
  calendarId: string,
  loanId: number,
  kameKey?: string,
): Promise<calendar_v3.Schema$Event[]> {
  const { calendar } = getGroupCalendarApi();
  const privateKey = kameKey ? `kameKey=${kameKey}` : `kameLoanId=${loanId}`;
  try {
    const res = await mutate(() =>
      calendar.events.list({
        calendarId,
        privateExtendedProperty: [privateKey],
        maxResults: 50,
        singleEvents: true,
      }),
    );
    return res.data.items ?? [];
  } catch (error) {
    if (isGoogleCalendarNotFoundError(error)) return [];
    throw error;
  }
}

export async function removeGroupLoanEvents(
  calendarId: string,
  loanId: number,
): Promise<void> {
  const { calendar } = getGroupCalendarApi();
  const events = await findEventsByLoanId(calendarId, loanId);
  for (const event of events) {
    if (!event.id) continue;
    await mutate(() =>
      calendar.events.delete({ calendarId, eventId: event.id! }),
    );
  }
}

export async function syncGroupSummaries(
  groupId: number,
  dateKeys: string[],
): Promise<void> {
  if (dateKeys.length === 0) return;

  const row = await db.query.groupCalendars.findFirst({
    where: eq(groupCalendars.groupId, groupId),
  });
  if (!row?.googleCalendarId) {
    await provisionGroupCalendar(groupId);
    return syncGroupSummaries(groupId, dateKeys);
  }

  const links = await db
    .select({ loanId: loanGroupLoans.loanId })
    .from(loanGroupLoans)
    .where(eq(loanGroupLoans.groupId, groupId));
  const loanIds = links.map((l) => l.loanId);
  let loans: LoanWithInvestors[] = [];
  if (loanIds.length > 0) {
    const rows = await db.query.loans.findMany({
      where: inArray(loansTable.id, loanIds),
      with: {
        borrower: true,
        loanInvestors: {
          with: {
            investor: true,
            interestPeriods: true,
            receivedPayments: true,
          },
        },
        loanWitnesses: { with: { witness: true } },
      },
    });
    loans = rows as LoanWithInvestors[];
  }

  const {
    calendarEventKey,
    formatCalendarCurrency,
    googleAllDayRange,
    totalSummaryTitle,
  } = await import("$lib/calendar-events");
  const dailyEvents = collectDailySummaryDays(loans);
  const { calendar } = getGroupCalendarApi();
  const appUrl = resolveAppUrl();
  const calendarId = row.googleCalendarId;

  for (const dateKey of dateKeys) {
    const dayData = dailyEvents.get(dateKey);
    const key = calendarEventKey("summary", dateKey);

    if (!dayData) {
      const stale = await findEventsByPrivateKey(calendarId, key);
      for (const event of stale) {
        if (!event.id) continue;
        await mutate(() =>
          calendar.events.delete({ calendarId, eventId: event.id! }),
        );
      }
      continue;
    }

    const allLoans = [...dayData.out.loans, ...dayData.in.loans];
    const uniqueLoans = Array.from(
      new Map(allLoans.map((l) => [l.id, l])).values(),
    );
    if (uniqueLoans.length === 0) continue;

    const totalAmount =
      dayData.in.amount > 0 && dayData.out.amount > 0
        ? dayData.in.amount - dayData.out.amount
        : dayData.in.amount > 0
          ? dayData.in.amount
          : -dayData.out.amount;

    let description = "Loans:\n";
    for (const loan of uniqueLoans) {
      const loanData = dayData.loanAmounts.get(loan.id);
      if (!loanData) continue;
      const sign = loanData.isOut ? "-" : "+";
      description += `  • ${loan.loanName}: ${sign}${formatCalendarCurrency(Math.abs(loanData.amount))}\n`;
    }
    const sign = totalAmount >= 0 ? "+" : "-";
    description += `\n<b>Total: ${sign}${formatCalendarCurrency(Math.abs(totalAmount))}</b>\n`;
    description += `\n<a href="${appUrl}/groups/${groupId}">Open group</a>`;

    const range = googleAllDayRange(dateKey);
    const body: calendar_v3.Schema$Event = {
      summary: totalSummaryTitle(totalAmount),
      description,
      start: range.start,
      end: range.end,
      colorId: googleCalendarColorIdForKind("summary"),
      extendedProperties: {
        private: { kameKey: key, kameKind: "summary" },
      },
    };

    const existing = await findEventsByPrivateKey(calendarId, key);
    let keepEventId = existing[0]?.id ?? undefined;
    if (keepEventId) {
      await mutate(() =>
        calendar.events.patch({
          calendarId,
          eventId: keepEventId!,
          requestBody: body,
        }),
      );
    } else {
      const created = await mutate(() =>
        calendar.events.insert({ calendarId, requestBody: body }),
      );
      keepEventId = created.data.id ?? undefined;
    }
    await deleteCalendarEvents(
      calendarId,
      planSummaryCalendarEventDeletions(existing, keepEventId),
    );
  }

  await db
    .update(groupCalendars)
    .set({ lastEventSyncAt: new Date(), updatedAt: new Date() })
    .where(eq(groupCalendars.groupId, groupId));
}

async function findEventsByPrivateKey(
  calendarId: string,
  kameKey: string,
): Promise<calendar_v3.Schema$Event[]> {
  const { calendar } = getGroupCalendarApi();
  try {
    const res = await mutate(() =>
      calendar.events.list({
        calendarId,
        privateExtendedProperty: [`kameKey=${kameKey}`],
        maxResults: 20,
        singleEvents: true,
      }),
    );
    return res.data.items ?? [];
  } catch (error) {
    if (isGoogleCalendarNotFoundError(error)) return [];
    throw error;
  }
}

export async function deleteGroupCalendar(calendarId: string): Promise<void> {
  const { calendar } = getGroupCalendarApi();
  try {
    await mutate(() => calendar.calendars.delete({ calendarId }));
  } catch (error) {
    if (isGoogleCalendarNotFoundError(error)) return;
    throw error;
  }
}
