import { json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { db } from "$lib/server/db";
import { loanGroupLoans, groupCalendars } from "$lib/server/db/schema";
import { and, eq, inArray } from "drizzle-orm";
import { getSession } from "$lib/server/session";
import { hasLoanAdminAccess } from "$lib/server/access-control";
import { recomputeGroupsForLoans } from "$lib/server/group-access";
import { hasGroupManageAccess } from "$lib/server/group-access";
import { parseJsonBody, setLoanGroupsBodySchema } from "$lib/group-validation";
import {
  invalidateGroupData,
  invalidateLoanData,
} from "$lib/server/cache-invalidation";
import { enqueueJob } from "$lib/server/jobs/queue";
import { scheduleDrain } from "$lib/server/jobs/after-response";

export const PUT: RequestHandler = async (event) => {
  try {
    const session = await getSession(event);
    if (!session?.user?.id) {
      return json({ error: "Unauthorized" }, { status: 401 });
    }

    const loanId = parseInt(event.params.id);
    if (!(await hasLoanAdminAccess(loanId, session.user.id))) {
      return json({ error: "Loan not found" }, { status: 404 });
    }

    const parsed = parseJsonBody(
      setLoanGroupsBodySchema,
      await event.request.json(),
    );
    if ("error" in parsed) {
      return json({ error: parsed.error }, { status: 400 });
    }
    const desired = new Set(parsed.data.groupIds);

    for (const groupId of desired) {
      if (!(await hasGroupManageAccess(groupId, session.user.id))) {
        return json(
          { error: `Cannot manage group ${groupId}` },
          { status: 403 },
        );
      }
    }

    const current = await db
      .select({ groupId: loanGroupLoans.groupId })
      .from(loanGroupLoans)
      .where(eq(loanGroupLoans.loanId, loanId));
    const currentIds = new Set(current.map((r) => r.groupId));

    const toAdd = [...desired].filter((id) => !currentIds.has(id));
    const toRemove = [...currentIds].filter((id) => !desired.has(id));

    if (toAdd.length > 0) {
      await db.insert(loanGroupLoans).values(
        toAdd.map((groupId) => ({
          groupId,
          loanId,
          source: "manual" as const,
          addedByUserId: session.user!.id,
        })),
      );
    }
    if (toRemove.length > 0) {
      const calendars = await db
        .select({
          groupId: groupCalendars.groupId,
          googleCalendarId: groupCalendars.googleCalendarId,
        })
        .from(groupCalendars)
        .where(inArray(groupCalendars.groupId, toRemove));
      const calMap = new Map(
        calendars.map((c) => [c.groupId, c.googleCalendarId]),
      );

      await db
        .delete(loanGroupLoans)
        .where(
          and(
            eq(loanGroupLoans.loanId, loanId),
            inArray(loanGroupLoans.groupId, toRemove),
          ),
        );

      for (const groupId of toRemove) {
        const calendarId = calMap.get(groupId);
        if (calendarId) {
          await enqueueJob({
            kind: "group.calendar.removeLoan",
            groupId,
            payload: { loanId, calendarId },
          });
        }
      }
    }

    for (const groupId of toAdd) {
      await enqueueJob({
        kind: "group.calendar.syncLoan",
        groupId,
        payload: { loanId },
        dedupeKey: `group.calendar.syncLoan:${groupId}:${loanId}`,
      });
    }

    await recomputeGroupsForLoans([loanId]);
    invalidateGroupData();
    invalidateLoanData();
    scheduleDrain(event);
    return json({ success: true, groupIds: [...desired] });
  } catch (error) {
    console.error("Error setting loan groups:", error);
    return json({ error: "Failed to set loan groups" }, { status: 500 });
  }
};
