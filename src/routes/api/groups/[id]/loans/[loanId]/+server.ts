import { json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { db } from "$lib/server/db";
import { loanGroupLoans, groupCalendars } from "$lib/server/db/schema";
import { and, eq } from "drizzle-orm";
import { getSession } from "$lib/server/session";
import {
  invalidateGroupData,
  invalidateLoanData,
} from "$lib/server/cache-invalidation";
import {
  hasGroupManageAccess,
  recomputeGroupMembers,
} from "$lib/server/group-access";
import { enqueueJob } from "$lib/server/jobs/queue";
import { scheduleDrain } from "$lib/server/jobs/after-response";

export const DELETE: RequestHandler = async (event) => {
  const { params } = event;
  try {
    const session = await getSession(event);
    if (!session?.user?.id) {
      return json({ error: "Unauthorized" }, { status: 401 });
    }

    const groupId = parseInt(params.id);
    const loanId = parseInt(params.loanId);
    if (!(await hasGroupManageAccess(groupId, session.user.id))) {
      return json({ error: "Group not found" }, { status: 404 });
    }

    const calendar = await db.query.groupCalendars.findFirst({
      where: eq(groupCalendars.groupId, groupId),
      columns: { googleCalendarId: true },
    });

    await db
      .delete(loanGroupLoans)
      .where(
        and(
          eq(loanGroupLoans.groupId, groupId),
          eq(loanGroupLoans.loanId, loanId),
        ),
      );

    await recomputeGroupMembers(groupId);

    if (calendar?.googleCalendarId) {
      await enqueueJob({
        kind: "group.calendar.removeLoan",
        groupId,
        payload: {
          loanId,
          calendarId: calendar.googleCalendarId,
        },
      });
      scheduleDrain(event);
    }

    invalidateGroupData();
    invalidateLoanData();
    return json({ success: true });
  } catch (error) {
    console.error("Error removing loan from group:", error);
    return json({ error: "Failed to remove loan from group" }, { status: 500 });
  }
};
