import { json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { db } from "$lib/server/db";
import { loanGroupLoans } from "$lib/server/db/schema";
import { getSession } from "$lib/server/session";
import { invalidateGroupData } from "$lib/server/cache-invalidation";
import { hasGroupEditAccess, syncGroupMembersForLoan } from "$lib/server/group-access";
import { hasLoanViewAccess } from "$lib/server/access-control";

export const POST: RequestHandler = async (event) => {
  const { params, request } = event;
  try {
    const session = await getSession(event);
    if (!session?.user?.id) {
      return json({ error: "Unauthorized" }, { status: 401 });
    }

    const groupId = parseInt(params.id);
    if (!(await hasGroupEditAccess(groupId, session.user.id))) {
      return json({ error: "Group not found" }, { status: 404 });
    }

    const body = await request.json();
    const loanId = parseInt(body.loanId);
    if (!loanId) {
      return json({ error: "loanId is required" }, { status: 400 });
    }
    if (!(await hasLoanViewAccess(loanId, session.user.id))) {
      return json({ error: "Loan not found" }, { status: 404 });
    }

    await db
      .insert(loanGroupLoans)
      .values({ groupId, loanId })
      .onConflictDoNothing();
    await syncGroupMembersForLoan(groupId, loanId);

    invalidateGroupData();
    return json({ success: true }, { status: 201 });
  } catch (error) {
    console.error("Error adding loan to group:", error);
    return json({ error: "Failed to add loan to group" }, { status: 500 });
  }
};
