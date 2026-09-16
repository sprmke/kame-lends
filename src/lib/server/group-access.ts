import { db } from "$lib/server/db";
import {
  loanGroups,
  loanGroupLoans,
  loanGroupMembers,
  loanGroupRules,
  loans,
  loanInvestors,
  investors,
  borrowers,
  loanWitnesses,
  witnesses,
  users,
} from "$lib/server/db/schema";
import { and, eq, inArray, sql } from "drizzle-orm";
import { invalidateGroupData } from "$lib/server/cache-invalidation";
import {
  diffGroupMembers,
  rolesChanged,
  type MemberSnapshot,
  type PartyRole,
} from "$lib/group-membership-diff";
import { matchGroupRulesForLoan, type GroupRule } from "$lib/group-rules";
import { normalizeEmail } from "$lib/loan-signing";
import { findOrCreatePartyUser } from "$lib/server/party-user";
import { findUserByNormalizedEmail } from "$lib/server/auth-sign-in";
import { invalidateWitnessData } from "$lib/server/cache-invalidation";

export type { PartyRole };

/**
 * Links `witnesses.witness_user_id` from witness email (same as witness CRM create)
 * so group membership and calendar ACL can include loan witnesses.
 */
export async function syncWitnessUserLinksForLoans(
  loanIds: number[],
): Promise<void> {
  if (loanIds.length === 0) return;

  const rows = await db
    .select({
      witnessId: witnesses.id,
      witnessUserId: witnesses.witnessUserId,
      email: witnesses.email,
      name: witnesses.name,
    })
    .from(loanWitnesses)
    .innerJoin(witnesses, eq(loanWitnesses.witnessId, witnesses.id))
    .where(inArray(loanWitnesses.loanId, loanIds));

  let linked = false;
  for (const row of rows) {
    if (row.witnessUserId) continue;
    const email = row.email?.trim();
    if (!email) continue;
    const partyUser = await findOrCreatePartyUser({
      email,
      name: row.name,
      role: "witness",
    });
    if (!partyUser) continue;
    await db
      .update(witnesses)
      .set({ witnessUserId: partyUser.id, updatedAt: new Date() })
      .where(eq(witnesses.id, row.witnessId));
    linked = true;
  }
  if (linked) invalidateWitnessData();
}

async function findGroup(groupId: number) {
  return db.query.loanGroups.findFirst({ where: eq(loanGroups.id, groupId) });
}

export async function hasGroupViewAccess(
  groupId: number,
  userId: string,
): Promise<boolean> {
  const group = await findGroup(groupId);
  if (!group) return false;
  if (group.creatorUserId === userId) return true;

  const membership = await db.query.loanGroupMembers.findFirst({
    where: and(
      eq(loanGroupMembers.groupId, groupId),
      eq(loanGroupMembers.userId, userId),
    ),
    columns: { id: true },
  });
  return Boolean(membership);
}

/** Group creator only. Replaces hasGroupEditAccess. */
export async function hasGroupManageAccess(
  groupId: number,
  userId: string,
): Promise<boolean> {
  const group = await findGroup(groupId);
  if (!group) return false;
  return group.creatorUserId === userId;
}

/** @deprecated Use hasGroupManageAccess */
export const hasGroupEditAccess = hasGroupManageAccess;

/**
 * One batched query: Map<userId, Set<role>> for all parties on the given loans.
 * Email-only invitations without a user row are skipped.
 */
export async function resolvePartyUsersForLoans(
  loanIds: number[],
): Promise<Map<string, Set<PartyRole>>> {
  const result = new Map<string, Set<PartyRole>>();
  if (loanIds.length === 0) return result;

  const add = (userId: string | null | undefined, role: PartyRole) => {
    if (!userId) return;
    let set = result.get(userId);
    if (!set) {
      set = new Set();
      result.set(userId, set);
    }
    set.add(role);
  };

  const loanRows = await db
    .select({
      id: loans.id,
      userId: loans.userId,
      borrowerUserId: borrowers.borrowerUserId,
    })
    .from(loans)
    .leftJoin(borrowers, eq(loans.borrowerId, borrowers.id))
    .where(inArray(loans.id, loanIds));

  for (const row of loanRows) {
    add(row.userId, "owner");
    add(row.borrowerUserId, "borrower");
  }

  const investorRows = await db
    .select({
      investorUserId: investors.investorUserId,
    })
    .from(loanInvestors)
    .innerJoin(investors, eq(loanInvestors.investorId, investors.id))
    .where(inArray(loanInvestors.loanId, loanIds));

  for (const row of investorRows) {
    add(row.investorUserId, "investor");
  }

  const witnessRows = await db
    .select({
      witnessUserId: witnesses.witnessUserId,
      email: witnesses.email,
    })
    .from(loanWitnesses)
    .innerJoin(witnesses, eq(loanWitnesses.witnessId, witnesses.id))
    .where(inArray(loanWitnesses.loanId, loanIds));

  const witnessEmailsWithoutUser = new Set<string>();
  for (const row of witnessRows) {
    add(row.witnessUserId, "witness");
    if (!row.witnessUserId && row.email) {
      const normalized = normalizeEmail(row.email);
      if (normalized) witnessEmailsWithoutUser.add(normalized);
    }
  }
  for (const email of witnessEmailsWithoutUser) {
    const user = await findUserByNormalizedEmail(email);
    if (user) add(user.id, "witness");
  }

  return result;
}

/** Legacy single-loan helper kept for callers that still pass one id. */
export async function resolveLoanPartyUserIds(
  loanId: number,
): Promise<string[]> {
  const map = await resolvePartyUsersForLoans([loanId]);
  return [...map.keys()];
}

async function loadMemberSnapshots(
  groupId: number,
): Promise<Map<string, MemberSnapshot>> {
  const rows = await db
    .select({
      userId: loanGroupMembers.userId,
      partyRoles: loanGroupMembers.partyRoles,
      name: users.name,
      email: users.email,
    })
    .from(loanGroupMembers)
    .innerJoin(users, eq(loanGroupMembers.userId, users.id))
    .where(eq(loanGroupMembers.groupId, groupId));

  const map = new Map<string, MemberSnapshot>();
  for (const row of rows) {
    map.set(row.userId, {
      userId: row.userId,
      roles: (row.partyRoles ?? []) as PartyRole[],
      name: row.name ?? undefined,
      email: row.email,
    });
  }
  return map;
}

async function enrichDesired(
  desired: Map<string, Set<PartyRole>>,
): Promise<Map<string, MemberSnapshot>> {
  if (desired.size === 0) return new Map();
  const userIds = [...desired.keys()];
  const rows = await db
    .select({
      id: users.id,
      name: users.name,
      email: users.email,
    })
    .from(users)
    .where(inArray(users.id, userIds));

  const map = new Map<string, MemberSnapshot>();
  for (const row of rows) {
    map.set(row.id, {
      userId: row.id,
      roles: desired.get(row.id) ?? new Set(),
      name: row.name ?? undefined,
      email: row.email,
    });
  }
  return map;
}

export type RecomputeResult = {
  changed: boolean;
  gained: string[];
  lost: string[];
};

/**
 * Recompute membership for a group in one transaction.
 * If members change, enqueues ACL sync via optional hook (passed to avoid cycle).
 */
export async function recomputeGroupMembers(
  groupId: number,
  options?: {
    enqueueAcl?: (groupId: number) => Promise<void>;
  },
): Promise<RecomputeResult> {
  const groupLoanRows = await db
    .select({ loanId: loanGroupLoans.loanId })
    .from(loanGroupLoans)
    .where(eq(loanGroupLoans.groupId, groupId));
  const loanIds = groupLoanRows.map((r) => r.loanId);

  await syncWitnessUserLinksForLoans(loanIds);
  const desiredRoles = await resolvePartyUsersForLoans(loanIds);
  const desired = await enrichDesired(desiredRoles);
  const current = await loadMemberSnapshots(groupId);
  const diff = diffGroupMembers(current, desired);

  let rolesUpdated = false;
  const now = new Date();

  await db.transaction(async (tx) => {
    for (const [userId, member] of desired) {
      const roles = [
        ...(member.roles instanceof Set ? member.roles : member.roles),
      ] as PartyRole[];
      const existing = current.get(userId);
      if (!existing) {
        await tx
          .insert(loanGroupMembers)
          .values({
            groupId,
            userId,
            partyRoles: roles,
            syncedAt: now,
          })
          .onConflictDoNothing();
      } else if (rolesChanged(existing.roles, roles)) {
        rolesUpdated = true;
        await tx
          .update(loanGroupMembers)
          .set({
            partyRoles: roles,
            syncedAt: now,
            updatedAt: now,
          })
          .where(
            and(
              eq(loanGroupMembers.groupId, groupId),
              eq(loanGroupMembers.userId, userId),
            ),
          );
      } else {
        await tx
          .update(loanGroupMembers)
          .set({ syncedAt: now, updatedAt: now })
          .where(
            and(
              eq(loanGroupMembers.groupId, groupId),
              eq(loanGroupMembers.userId, userId),
            ),
          );
      }
    }

    const staleIds = [...current.keys()].filter((id) => !desired.has(id));
    if (staleIds.length > 0) {
      await tx
        .delete(loanGroupMembers)
        .where(
          and(
            eq(loanGroupMembers.groupId, groupId),
            inArray(loanGroupMembers.userId, staleIds),
          ),
        );
    }
  });

  const changed =
    diff.gained.length > 0 || diff.lost.length > 0 || rolesUpdated;

  if (changed) {
    invalidateGroupData();
    if (options?.enqueueAcl) {
      await options.enqueueAcl(groupId);
    } else {
      // Lazy import to avoid circular deps with jobs/queue
      try {
        const { enqueueJob } = await import("$lib/server/jobs/queue");
        await enqueueJob({
          kind: "group.calendar.acl",
          groupId,
          dedupeKey: `group.calendar.acl:${groupId}`,
        });
      } catch {
        // Jobs module may not be ready during early migrate/backfill
      }
    }
  }

  return {
    changed,
    gained: diff.gained.map((p) => p.userId),
    lost: diff.lost.map((p) => p.userId),
  };
}

export async function recomputeGroupsForLoans(
  loanIds: number[],
): Promise<number[]> {
  if (loanIds.length === 0) return [];
  const rows = await db
    .selectDistinct({ groupId: loanGroupLoans.groupId })
    .from(loanGroupLoans)
    .where(inArray(loanGroupLoans.loanId, loanIds));
  const groupIds = rows.map((r) => r.groupId);
  for (const groupId of groupIds) {
    await recomputeGroupMembers(groupId);
  }
  return groupIds;
}

export async function applyGroupRulesForLoan(
  loanId: number,
  addedByUserId?: string | null,
): Promise<number[]> {
  const loan = await db.query.loans.findFirst({
    where: eq(loans.id, loanId),
    columns: { id: true, borrowerId: true, userId: true },
    with: {
      loanInvestors: { columns: { investorId: true } },
    },
  });
  if (!loan) return [];

  const allRules = await db.select().from(loanGroupRules);
  const matched = matchGroupRulesForLoan(
    {
      borrowerId: loan.borrowerId,
      investorIds: loan.loanInvestors.map((li) => li.investorId),
    },
    allRules as GroupRule[],
  );
  if (matched.length === 0) return [];

  const groupIds = [...new Set(matched.map((r) => r.groupId))];
  for (const groupId of groupIds) {
    const group = await findGroup(groupId);
    if (!group) continue;
    if (group.creatorUserId !== loan.userId) continue;
    await db
      .insert(loanGroupLoans)
      .values({
        groupId,
        loanId,
        source: "rule",
        addedByUserId: addedByUserId ?? null,
      })
      .onConflictDoNothing();
  }

  await recomputeGroupsForLoans([loanId]);
  return groupIds;
}

export async function previewAccessForLoanIds(options: {
  existingLoanIds: number[];
  addLoanIds?: number[];
  removeLoanIds?: number[];
}): Promise<{
  gained: ReturnType<typeof diffGroupMembers>["gained"];
  lost: ReturnType<typeof diffGroupMembers>["lost"];
  unchanged: number;
  mixedBorrowerCount: number;
  resultingLoanIds: number[];
}> {
  const remove = new Set(options.removeLoanIds ?? []);
  const resulting = new Set(
    options.existingLoanIds.filter((id) => !remove.has(id)),
  );
  for (const id of options.addLoanIds ?? []) resulting.add(id);
  const resultingLoanIds = [...resulting];

  await syncWitnessUserLinksForLoans(resultingLoanIds);

  const currentRoles = await resolvePartyUsersForLoans(options.existingLoanIds);
  const desiredRoles = await resolvePartyUsersForLoans(resultingLoanIds);
  const current = await enrichDesired(currentRoles);
  const desired = await enrichDesired(desiredRoles);
  const diff = diffGroupMembers(current, desired);

  const borrowerRows =
    resultingLoanIds.length === 0
      ? []
      : await db
          .selectDistinct({ borrowerId: loans.borrowerId })
          .from(loans)
          .where(inArray(loans.id, resultingLoanIds));
  const distinctBorrowers = new Set(
    borrowerRows
      .map((r) => r.borrowerId)
      .filter((id): id is number => id != null),
  );

  return {
    ...diff,
    mixedBorrowerCount: distinctBorrowers.size,
    resultingLoanIds,
  };
}

export async function getGroupLoanIds(groupId: number): Promise<number[]> {
  const rows = await db
    .select({ loanId: loanGroupLoans.loanId })
    .from(loanGroupLoans)
    .where(eq(loanGroupLoans.groupId, groupId));
  return rows.map((r) => r.loanId);
}

/** User has a membership row or created a group. */
export async function userHasAnyGroupMembership(
  userId: string,
): Promise<boolean> {
  const row = await db
    .select({ id: loanGroupMembers.id })
    .from(loanGroupMembers)
    .where(eq(loanGroupMembers.userId, userId))
    .limit(1);
  if (row.length > 0) return true;
  const created = await db
    .select({ id: loanGroups.id })
    .from(loanGroups)
    .where(eq(loanGroups.creatorUserId, userId))
    .limit(1);
  return created.length > 0;
}
