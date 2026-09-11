import { db } from "$lib/server/db";
import {
  loanGroups,
  loanGroupLoans,
  loanGroupMembers,
  loans,
  loanInvestors,
  investors,
  borrowers,
  loanWitnesses,
  witnesses,
} from "$lib/server/db/schema";
import { eq, and, inArray } from "drizzle-orm";
import { isWorkspaceAdmin } from "$lib/server/workspace-admin";

export type GroupRole = "creator" | "member" | "admin" | null;

async function findGroup(groupId: number) {
  return db.query.loanGroups.findFirst({ where: eq(loanGroups.id, groupId) });
}

async function findActiveMembership(groupId: number, userId: string) {
  return db.query.loanGroupMembers.findFirst({
    where: and(
      eq(loanGroupMembers.groupId, groupId),
      eq(loanGroupMembers.userId, userId),
    ),
  });
}

export async function hasGroupViewAccess(
  groupId: number,
  userId: string,
): Promise<boolean> {
  const group = await findGroup(groupId);
  if (!group) return false;
  if (group.creatorUserId === userId) return true;
  if (await isWorkspaceAdmin(userId)) return true;

  const membership = await findActiveMembership(groupId, userId);
  return membership?.status === "active";
}

export async function hasGroupEditAccess(
  groupId: number,
  userId: string,
): Promise<boolean> {
  const group = await findGroup(groupId);
  if (!group) return false;
  if (group.creatorUserId === userId) return true;
  return isWorkspaceAdmin(userId);
}

export async function canLeaveGroup(
  groupId: number,
  userId: string,
): Promise<boolean> {
  const group = await findGroup(groupId);
  if (!group) return false;
  if (group.creatorUserId === userId) return false;

  const membership = await findActiveMembership(groupId, userId);
  return membership?.status === "active";
}

/**
 * All distinct user ids linked as a party on this loan: owner, investors,
 * borrower, witnesses. Email-only signing invitations not yet linked to a
 * `users` row are skipped — they get picked up on the next sync once that
 * contact is linked via findOrCreatePartyUser.
 */
export async function resolveLoanPartyUserIds(
  loanId: number,
): Promise<string[]> {
  const loan = await db.query.loans.findFirst({
    where: eq(loans.id, loanId),
    columns: { id: true, userId: true, borrowerId: true },
    with: {
      borrower: { columns: { borrowerUserId: true } },
      loanInvestors: {
        columns: {},
        with: { investor: { columns: { investorUserId: true } } },
      },
      loanWitnesses: {
        columns: {},
        with: { witness: { columns: { witnessUserId: true } } },
      },
    },
  });
  if (!loan) return [];

  const ids = new Set<string>();
  ids.add(loan.userId);
  if (loan.borrower?.borrowerUserId) ids.add(loan.borrower.borrowerUserId);
  for (const li of loan.loanInvestors) {
    if (li.investor?.investorUserId) ids.add(li.investor.investorUserId);
  }
  for (const lw of loan.loanWitnesses) {
    if (lw.witness?.witnessUserId) ids.add(lw.witness.witnessUserId);
  }

  return [...ids];
}

/**
 * Additive-only: inserts an active member row for any loan party who has no
 * row yet. Never touches an existing row, so a "left"/"removed" member is
 * never silently re-added.
 */
export async function syncGroupMembersForLoan(
  groupId: number,
  loanId: number,
): Promise<void> {
  const partyUserIds = await resolveLoanPartyUserIds(loanId);
  if (partyUserIds.length === 0) return;

  const existing = await db.query.loanGroupMembers.findMany({
    where: and(
      eq(loanGroupMembers.groupId, groupId),
      inArray(loanGroupMembers.userId, partyUserIds),
    ),
    columns: { userId: true },
  });
  const existingIds = new Set(existing.map((row) => row.userId));
  const missingIds = partyUserIds.filter((id) => !existingIds.has(id));
  if (missingIds.length === 0) return;

  await db
    .insert(loanGroupMembers)
    .values(missingIds.map((userId) => ({ groupId, userId, status: "active" as const })))
    .onConflictDoNothing();
}

/** Re-syncs membership for every loan currently in the group. */
export async function syncGroupMembers(groupId: number): Promise<void> {
  const groupLoans = await db.query.loanGroupLoans.findMany({
    where: eq(loanGroupLoans.groupId, groupId),
    columns: { loanId: true },
  });
  for (const { loanId } of groupLoans) {
    await syncGroupMembersForLoan(groupId, loanId);
  }
}
