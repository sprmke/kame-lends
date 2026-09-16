import { json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { eq } from "drizzle-orm";
import { getSession } from "$lib/server/session";
import { db } from "$lib/server/db";
import { loanGroups } from "$lib/server/db/schema";
import { hasGroupManageAccess } from "$lib/server/group-access";
import { loadAddableLoansForGroup } from "$lib/server/group-wizard-data";
import { buildWizardContactOptions } from "$lib/groups/group-list-map";
import { getCachedLoansByScope } from "$lib/server/cached-data";

export const GET: RequestHandler = async (event) => {
  const session = await getSession(event);
  if (!session?.user?.id) {
    return json({ error: "Unauthorized" }, { status: 401 });
  }

  const groupId = Number(event.params.id);
  if (!Number.isFinite(groupId)) {
    return json({ error: "Group not found" }, { status: 404 });
  }

  if (!(await hasGroupManageAccess(groupId, session.user.id))) {
    return json({ error: "Forbidden" }, { status: 403 });
  }

  const group = await db.query.loanGroups.findFirst({
    where: eq(loanGroups.id, groupId),
    columns: { id: true },
    with: { groupLoans: { columns: { loanId: true } } },
  });
  if (!group) {
    return json({ error: "Group not found" }, { status: 404 });
  }

  const inGroupIds = new Set(group.groupLoans.map((link) => link.loanId));

  try {
    const [addableLoans, ownedLoans] = await Promise.all([
      loadAddableLoansForGroup(session.user.id, inGroupIds),
      getCachedLoansByScope(session.user.id, "owned", "list"),
    ]);
    return json({
      addableLoans,
      ruleContacts: buildWizardContactOptions(ownedLoans),
    });
  } catch (error) {
    console.error("Error loading addable group loans:", error);
    return json({ error: "Failed to load loans" }, { status: 500 });
  }
};
