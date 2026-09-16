import { json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { db } from "$lib/server/db";
import {
  loanGroupRules,
  loanGroupLoans,
  loans,
  loanInvestors,
} from "$lib/server/db/schema";
import { and, eq } from "drizzle-orm";
import { getSession } from "$lib/server/session";
import {
  hasGroupManageAccess,
  hasGroupViewAccess,
  recomputeGroupMembers,
} from "$lib/server/group-access";
import { createRuleBodySchema, parseJsonBody } from "$lib/group-validation";
import {
  invalidateGroupData,
  invalidateLoanData,
} from "$lib/server/cache-invalidation";
import { enqueueJob } from "$lib/server/jobs/queue";
import { scheduleDrain } from "$lib/server/jobs/after-response";

export const GET: RequestHandler = async (event) => {
  try {
    const session = await getSession(event);
    if (!session?.user?.id) {
      return json({ error: "Unauthorized" }, { status: 401 });
    }
    const groupId = parseInt(event.params.id);
    if (!(await hasGroupViewAccess(groupId, session.user.id))) {
      return json({ error: "Group not found" }, { status: 404 });
    }
    const rules = await db.query.loanGroupRules.findMany({
      where: eq(loanGroupRules.groupId, groupId),
    });
    return json(rules);
  } catch (error) {
    console.error("Error listing rules:", error);
    return json({ error: "Failed to list rules" }, { status: 500 });
  }
};

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

    const parsed = parseJsonBody(
      createRuleBodySchema,
      await event.request.json(),
    );
    if ("error" in parsed) {
      return json({ error: parsed.error }, { status: 400 });
    }
    const { partyType, contactId, applyToExisting } = parsed.data;

    const [rule] = await db
      .insert(loanGroupRules)
      .values({
        groupId,
        partyType,
        contactId,
        createdByUserId: session.user.id,
      })
      .onConflictDoNothing()
      .returning();

    const saved =
      rule ??
      (await db.query.loanGroupRules.findFirst({
        where: and(
          eq(loanGroupRules.groupId, groupId),
          eq(loanGroupRules.partyType, partyType),
          eq(loanGroupRules.contactId, contactId),
        ),
      }));

    const addedLoanIds: number[] = [];
    if (applyToExisting) {
      let matchingLoanIds: number[] = [];
      if (partyType === "borrower") {
        const rows = await db
          .select({ id: loans.id })
          .from(loans)
          .where(
            and(
              eq(loans.userId, session.user.id),
              eq(loans.borrowerId, contactId),
            ),
          );
        matchingLoanIds = rows.map((r) => r.id);
      } else {
        const rows = await db
          .select({ loanId: loanInvestors.loanId })
          .from(loanInvestors)
          .innerJoin(loans, eq(loans.id, loanInvestors.loanId))
          .where(
            and(
              eq(loanInvestors.investorId, contactId),
              eq(loans.userId, session.user.id),
            ),
          );
        matchingLoanIds = rows.map((r) => r.loanId);
      }

      if (matchingLoanIds.length > 0) {
        await db
          .insert(loanGroupLoans)
          .values(
            matchingLoanIds.map((loanId) => ({
              groupId,
              loanId,
              source: "rule" as const,
              addedByUserId: session.user!.id,
            })),
          )
          .onConflictDoNothing();
        addedLoanIds.push(...matchingLoanIds);
      }
    }

    await recomputeGroupMembers(groupId);
    for (const loanId of addedLoanIds) {
      await enqueueJob({
        kind: "group.calendar.syncLoan",
        groupId,
        payload: { loanId },
        dedupeKey: `group.calendar.syncLoan:${groupId}:${loanId}`,
      });
    }
    invalidateGroupData();
    invalidateLoanData();
    scheduleDrain(event);
    return json({ rule: saved, addedLoanIds }, { status: 201 });
  } catch (error) {
    console.error("Error creating rule:", error);
    return json({ error: "Failed to create rule" }, { status: 500 });
  }
};
