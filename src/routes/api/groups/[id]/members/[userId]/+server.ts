import { json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { db } from "$lib/server/db";
import { loanGroups, loanGroupMembers } from "$lib/server/db/schema";
import { and, eq } from "drizzle-orm";
import { getSession } from "$lib/server/session";
import { invalidateGroupData } from "$lib/server/cache-invalidation";
import { hasGroupEditAccess } from "$lib/server/group-access";

export const DELETE: RequestHandler = async (event) => {
  const { params } = event;
  try {
    const session = await getSession(event);
    if (!session?.user?.id) {
      return json({ error: "Unauthorized" }, { status: 401 });
    }

    const groupId = parseInt(params.id);
    const targetUserId = params.userId;
    if (!(await hasGroupEditAccess(groupId, session.user.id))) {
      return json({ error: "Group not found" }, { status: 404 });
    }

    const group = await db.query.loanGroups.findFirst({
      where: eq(loanGroups.id, groupId),
      columns: { creatorUserId: true },
    });
    if (group?.creatorUserId === targetUserId) {
      return json(
        { error: "Cannot remove the group creator" },
        { status: 400 },
      );
    }

    await db
      .update(loanGroupMembers)
      .set({ status: "removed", updatedAt: new Date() })
      .where(
        and(
          eq(loanGroupMembers.groupId, groupId),
          eq(loanGroupMembers.userId, targetUserId),
        ),
      );

    invalidateGroupData();
    return json({ success: true });
  } catch (error) {
    console.error("Error removing group member:", error);
    return json({ error: "Failed to remove group member" }, { status: 500 });
  }
};
