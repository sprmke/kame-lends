import { json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { db } from "$lib/server/db";
import { loanGroupLoans } from "$lib/server/db/schema";
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
    const loanId = parseInt(params.loanId);
    if (!(await hasGroupEditAccess(groupId, session.user.id))) {
      return json({ error: "Group not found" }, { status: 404 });
    }

    await db
      .delete(loanGroupLoans)
      .where(
        and(
          eq(loanGroupLoans.groupId, groupId),
          eq(loanGroupLoans.loanId, loanId),
        ),
      );

    invalidateGroupData();
    return json({ success: true });
  } catch (error) {
    console.error("Error removing loan from group:", error);
    return json({ error: "Failed to remove loan from group" }, { status: 500 });
  }
};
