import { json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { db } from "$lib/server/db";
import { loans } from "$lib/server/db/schema";
import { eq } from "drizzle-orm";
import { getSession } from "$lib/server/session";
import {
  generateLoanCalendarEvents,
  generateDailySummaryEvents,
  deleteMultipleCalendarEvents,
  deleteCalendarEventBatch,
} from "$lib/server/google-calendar";
import {
  loansForCalendarSync,
  manilaTodayKey,
  planDailySummaryDateKeys,
  planLoansForSync,
  type CalendarSyncScope,
} from "$lib/calendar-sync-plan";

export const config = {
  maxDuration: 60,
};

const LOAN_BATCH = 1;
const SUMMARY_BATCH = 6;

function parseScope(value: unknown): CalendarSyncScope {
  if (value === "upcoming" || value === "open") return value;
  return "all";
}

const loanRelations = {
  loanInvestors: {
    with: {
      investor: true,
      interestPeriods: true,
    },
  },
} as const;

async function loadUserLoans(userId: string) {
  return db.query.loans.findMany({
    where: eq(loans.userId, userId),
    with: loanRelations,
  });
}

export const POST: RequestHandler = async (event) => {
  try {
    const session = await getSession(event);
    if (!session?.user?.id) {
      return json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = (await event.request.json().catch(() => ({}))) as Record<
      string,
      unknown
    >;
    const action = typeof body.action === "string" ? body.action : "";
    const scope = parseScope(body.scope);
    const todayKey = manilaTodayKey();
    const userId = session.user.id;

    if (action === "prepare") {
      const userLoans = await loadUserLoans(userId);
      const loanPlans = planLoansForSync(userLoans, scope, todayKey);
      const summaryDates = planDailySummaryDateKeys(userLoans, scope, todayKey);
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
      const batch = await deleteCalendarEventBatch(20);
      if (!batch.remaining) {
        await db
          .update(loans)
          .set({ googleCalendarEventIds: null })
          .where(eq(loans.userId, userId));
      }
      return json({
        success: true,
        action: "wipe",
        deleted: batch.deleted,
        remaining: batch.remaining,
      });
    }

    if (action === "loans") {
      const offset =
        typeof body.offset === "number" ? Math.max(0, body.offset) : 0;
      const userLoans = loansForCalendarSync(
        await loadUserLoans(userId),
        scope,
        todayKey,
      );
      const slice = userLoans.slice(offset, offset + LOAN_BATCH);
      const results = [];

      for (const loan of slice) {
        const calendarEventIds = await generateLoanCalendarEvents(loan, {
          scope,
          todayKey,
        });
        await db
          .update(loans)
          .set({
            googleCalendarEventIds:
              calendarEventIds.length > 0 ? calendarEventIds : null,
          })
          .where(eq(loans.id, loan.id));

        const dates = planLoansForSync([loan], scope, todayKey)[0]?.dates ?? [];
        results.push({
          loanId: loan.id,
          loanName: loan.loanName,
          eventCount: calendarEventIds.length,
          dates,
        });
      }

      return json({
        success: true,
        action: "loans",
        scope,
        offset,
        nextOffset: offset + slice.length,
        done: offset + slice.length >= userLoans.length,
        total: userLoans.length,
        results,
      });
    }

    if (action === "summaries") {
      const offset =
        typeof body.offset === "number" ? Math.max(0, body.offset) : 0;
      const userLoans = loansForCalendarSync(
        await loadUserLoans(userId),
        scope,
        todayKey,
      );
      const summaryDates = planDailySummaryDateKeys(userLoans, scope, todayKey);
      const dates = summaryDates.slice(offset, offset + SUMMARY_BATCH);
      const { created } = await generateDailySummaryEvents(userLoans, dates);
      return json({
        success: true,
        action: "summaries",
        scope,
        offset,
        nextOffset: offset + dates.length,
        done: offset + dates.length >= summaryDates.length,
        total: summaryDates.length,
        dates,
        created,
      });
    }

    const loanId = typeof body.loanId === "number" ? body.loanId : null;
    if (!loanId) {
      return json(
        {
          error:
            'Invalid action. Use "prepare", "wipe", "loans", "summaries", "sync", or "remove".',
        },
        { status: 400 },
      );
    }

    const loan = await db.query.loans.findFirst({
      where: eq(loans.id, loanId),
      with: loanRelations,
    });

    if (!loan) {
      return json({ error: "Loan not found" }, { status: 404 });
    }
    if (loan.userId !== userId) {
      return json({ error: "Forbidden" }, { status: 403 });
    }

    if (action === "sync") {
      const existingEventIds = loan.googleCalendarEventIds as string[] | null;
      if (existingEventIds && existingEventIds.length > 0) {
        await deleteMultipleCalendarEvents(existingEventIds);
      }

      const calendarEventIds = await generateLoanCalendarEvents(loan, {
        scope,
        todayKey,
      });

      if (calendarEventIds.length > 0) {
        await db
          .update(loans)
          .set({ googleCalendarEventIds: calendarEventIds })
          .where(eq(loans.id, loanId));

        return json({
          success: true,
          message: "Calendar events synced successfully",
          eventIds: calendarEventIds,
        });
      }
      return json({
        success: false,
        message: "No calendar events were created",
      });
    }

    if (action === "remove") {
      const existingEventIds = loan.googleCalendarEventIds as string[] | null;
      if (existingEventIds && existingEventIds.length > 0) {
        await deleteMultipleCalendarEvents(existingEventIds);
        await db
          .update(loans)
          .set({ googleCalendarEventIds: null })
          .where(eq(loans.id, loanId));
        return json({
          success: true,
          message: "Calendar events removed successfully",
        });
      }
      return json({
        success: false,
        message: "No calendar events to remove",
      });
    }

    return json(
      {
        error:
          'Invalid action. Use "prepare", "wipe", "loans", "summaries", "sync", or "remove".',
      },
      { status: 400 },
    );
  } catch (error) {
    console.error("Error syncing calendar events:", error);
    return json(
      {
        error: "Failed to sync calendar events",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
};

export const GET: RequestHandler = async () => {
  return json(
    {
      error: "Use POST batch sync",
      details:
        "Full calendar sync is POST /api/loans/sync-calendar with action prepare, wipe, loans, then summaries.",
    },
    { status: 405 },
  );
};
