import { json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { db } from "$lib/server/db";
import { loanGroupRules } from "$lib/server/db/schema";
import { and, eq } from "drizzle-orm";
import { getSession } from "$lib/server/session";
import { hasGroupManageAccess } from "$lib/server/group-access";
import { invalidateGroupData } from "$lib/server/cache-invalidation";
import { parseIdParam } from "$lib/server/route-params";

export const DELETE: RequestHandler = async (event) => {
  try {
    const session = await getSession(event);
    if (!session?.user?.id) {
      return json({ error: "Unauthorized" }, { status: 401 });
    }
    const groupId = parseIdParam(event.params.id);
    if (groupId === null) {
      return json({ error: "Invalid id" }, { status: 400 });
    }
    const ruleId = parseIdParam(event.params.ruleId);
    if (ruleId === null) {
      return json({ error: "Invalid id" }, { status: 400 });
    }
    if (!(await hasGroupManageAccess(groupId, session.user.id))) {
      return json({ error: "Group not found" }, { status: 404 });
    }

    await db
      .delete(loanGroupRules)
      .where(
        and(eq(loanGroupRules.id, ruleId), eq(loanGroupRules.groupId, groupId)),
      );

    invalidateGroupData();
    return json({ success: true });
  } catch (error) {
    console.error("Error deleting rule:", error);
    return json({ error: "Failed to delete rule" }, { status: 500 });
  }
};
