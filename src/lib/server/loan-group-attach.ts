import { db } from "$lib/server/db";
import { loanGroupLoans } from "$lib/server/db/schema";
import { eq } from "drizzle-orm";
import { hasGroupManageAccess } from "$lib/server/group-access";
import { recomputeGroupsForLoans } from "$lib/server/group-access";
import { enqueueJob } from "$lib/server/jobs/queue";

/** Attach a loan to groups the user manages. Skips groups already linked. */
export async function attachLoanToGroups(options: {
  loanId: number;
  groupIds: number[];
  addedByUserId: string;
}): Promise<number[]> {
  const { loanId, groupIds, addedByUserId } = options;
  const unique = [...new Set(groupIds)];
  if (unique.length === 0) return [];

  const current = await db
    .select({ groupId: loanGroupLoans.groupId })
    .from(loanGroupLoans)
    .where(eq(loanGroupLoans.loanId, loanId));
  const currentIds = new Set(current.map((r) => r.groupId));
  const toAdd: number[] = [];

  for (const groupId of unique) {
    if (!(await hasGroupManageAccess(groupId, addedByUserId))) {
      throw new Error(`Cannot manage group ${groupId}`);
    }
    if (!currentIds.has(groupId)) toAdd.push(groupId);
  }

  if (toAdd.length > 0) {
    await db.insert(loanGroupLoans).values(
      toAdd.map((groupId) => ({
        groupId,
        loanId,
        source: "manual" as const,
        addedByUserId,
      })),
    );
    await recomputeGroupsForLoans([loanId]);
  }

  return toAdd;
}

export async function enqueueSyncForLoanGroups(
  loanId: number,
  groupIds: number[],
): Promise<void> {
  for (const groupId of groupIds) {
    await enqueueJob({
      kind: "group.calendar.syncLoan",
      groupId,
      payload: { loanId },
      dedupeKey: `group.calendar.syncLoan:${groupId}:${loanId}`,
    });
  }
}
