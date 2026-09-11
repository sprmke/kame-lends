import { json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { db } from "$lib/server/db";
import { loanGroupMembers } from "$lib/server/db/schema";
import { and, eq } from "drizzle-orm";
import { getSession } from "$lib/server/session";
import { invalidateGroupData } from "$lib/server/cache-invalidation";
import { canLeaveGroup } from "$lib/server/group-access";

export const POST: RequestHandler = async (event) => {
  const { params } = event;
  try {
    const session = await getSession(event);
    if (!session?.user?.id) {
      return json({ error: "Unauthorized" }, { status: 401 });
    }

    const groupId = parseInt(params.id);
    if (!(await canLeaveGroup(groupId, session.user.id))) {
      return json({ error: "Cannot leave this group" }, { status: 403 });
    }

    await db
      .update(loanGroupMembers)
      .set({ status: "left", updatedAt: new Date() })
      .where(
        and(
          eq(loanGroupMembers.groupId, groupId),
          eq(loanGroupMembers.userId, session.user.id),
        ),
      );

    invalidateGroupData();
    return json({ success: true });
  } catch (error) {
    console.error("Error leaving group:", error);
    return json({ error: "Failed to leave group" }, { status: 500 });
  }
};
