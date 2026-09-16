import { json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { db } from "$lib/server/db";
import { groupCalendars, loanGroupLoans, loans } from "$lib/server/db/schema";
import { eq, inArray } from "drizzle-orm";
import { getSession } from "$lib/server/session";
import { hasGroupManageAccess } from "$lib/server/group-access";
import {
  loansForCalendarSync,
  manilaTodayKey,
  planDailySummaryDateKeys,
  planLoansForSync,
  type CalendarSyncScope,
} from "$lib/calendar-sync-plan";
import {
  provisionGroupCalendar,
  removeGroupLoanEvents,
  syncGroupLoanEvents,
  syncGroupSummaries,
} from "$lib/server/group-calendar";
import type { LoanWithInvestors } from "$lib/types";

export const config = {
  maxDuration: 60,
};

const LOAN_BATCH = 1;
const SUMMARY_BATCH = 6;

function parseScope(value: unknown): CalendarSyncScope {
  if (value === "upcoming" || value === "open") return value;
  return "all";
}

async function loadGroupLoans(groupId: number): Promise<LoanWithInvestors[]> {
  const links = await db
    .select({ loanId: loanGroupLoans.loanId })
    .from(loanGroupLoans)
    .where(eq(loanGroupLoans.groupId, groupId));
  const loanIds = links.map((row) => row.loanId);
  if (loanIds.length === 0) return [];

  const rows = await db.query.loans.findMany({
    where: inArray(loans.id, loanIds),
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
  return rows as LoanWithInvestors[];
}

async function ensureGroupCalendar(groupId: number): Promise<string | null> {
  let row = await db.query.groupCalendars.findFirst({
    where: eq(groupCalendars.groupId, groupId),
  });
  if (!row?.googleCalendarId) {
    await provisionGroupCalendar(groupId);
    row = await db.query.groupCalendars.findFirst({
      where: eq(groupCalendars.groupId, groupId),
    });
  }
  return row?.googleCalendarId ?? null;
}

export const POST: RequestHandler = async (event) => {
  try {
    const session = await getSession(event);
    if (!session?.user?.id) {
      return json({ error: "Unauthorized" }, { status: 401 });
    }

    const groupId = parseInt(event.params.id);
    if (!(await hasGroupManageAccess(groupId, session.user.id))) {
      return json({ error: "Group not found" }, { status: 404 });
    }

    const body = (await event.request.json().catch(() => ({}))) as Record<
      string,
      unknown
    >;
    const action = typeof body.action === "string" ? body.action : "";
    const scope = parseScope(body.scope);
    const todayKey = manilaTodayKey();

    if (action === "prepare") {
      const groupLoans = await loadGroupLoans(groupId);
      const loanPlans = planLoansForSync(groupLoans, scope, todayKey);
      const summaryDates = planDailySummaryDateKeys(
        groupLoans,
        scope,
        todayKey,
      );
      const eventCount = loanPlans.reduce(
        (sum, plan) => sum + plan.eventCount,
        0,
      );
      return json({
        success: true,
        action: "prepare",
        scope,
        todayKey,
        loanCount: loanPlans.length,
        loansWithEvents: loanPlans.filter((plan) => plan.eventCount > 0).length,
        eventCount,
        summaryCount: summaryDates.length,
        loans: loanPlans,
        summaryDates,
        loanBatchSize: LOAN_BATCH,
        summaryBatchSize: SUMMARY_BATCH,
      });
    }

    if (action === "wipe") {
      const calendarId = await ensureGroupCalendar(groupId);
      if (!calendarId) {
        return json(
          { error: "Group calendar is not available" },
          { status: 503 },
        );
      }
      const offset =
        typeof body.offset === "number" ? Math.max(0, body.offset) : 0;
      const groupLoans = await loadGroupLoans(groupId);
      const slice = groupLoans.slice(offset, offset + LOAN_BATCH);
      let deleted = 0;
      for (const loan of slice) {
        await removeGroupLoanEvents(calendarId, loan.id);
        deleted += 1;
      }
      const remaining = Math.max(
        0,
        groupLoans.length - (offset + slice.length),
      );
      return json({
        success: true,
        action: "wipe",
        deleted,
        remaining,
        nextOffset: offset + slice.length,
      });
    }

    if (action === "loans") {
      const offset =
        typeof body.offset === "number" ? Math.max(0, body.offset) : 0;
      const groupLoans = loansForCalendarSync(
        await loadGroupLoans(groupId),
        scope,
        todayKey,
      );
      const slice = groupLoans.slice(offset, offset + LOAN_BATCH);
      const results = [];
      for (const loan of slice) {
        const plan = planLoansForSync([loan], scope, todayKey)[0];
        await syncGroupLoanEvents(groupId, loan.id);
        results.push({
          loanId: loan.id,
          loanName: loan.loanName,
          eventCount: plan?.eventCount ?? 0,
          dates: plan?.dates ?? [],
        });
      }
      return json({
        success: true,
        action: "loans",
        scope,
        offset,
        nextOffset: offset + slice.length,
        done: offset + slice.length >= groupLoans.length,
        total: groupLoans.length,
        results,
      });
    }

    if (action === "summaries") {
      const dateKeys = Array.isArray(body.dateKeys)
        ? body.dateKeys.filter(
            (value): value is string => typeof value === "string",
          )
        : [];
      const offset =
        typeof body.offset === "number" ? Math.max(0, body.offset) : 0;
      const keys =
        dateKeys.length > 0
          ? dateKeys
          : planDailySummaryDateKeys(
              await loadGroupLoans(groupId),
              scope,
              todayKey,
            );
      const slice = keys.slice(offset, offset + SUMMARY_BATCH);
      await syncGroupSummaries(groupId, slice);
      return json({
        success: true,
        action: "summaries",
        scope,
        offset,
        nextOffset: offset + slice.length,
        done: offset + slice.length >= keys.length,
        total: keys.length,
        dates: slice,
      });
    }

    return json({ error: "Unknown action" }, { status: 400 });
  } catch (error) {
    console.error("[group-calendar] sync", error);
    return json({ error: "Failed to sync group calendar" }, { status: 500 });
  }
};
