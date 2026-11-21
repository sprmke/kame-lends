import { normalizeEmail } from "$lib/loan-signing";
import {
  mergeEmailRecipients,
  withRoleLabels,
  type EmailPartyRole,
  type EmailRecipientSeed,
  type LoanEmailRecipient,
} from "$lib/email/recipient-merge";
import { db } from "$lib/server/db";
import {
  loanGroupMembers,
  loanGroups,
  loanInvestors,
  loans,
  users,
} from "$lib/server/db/schema";
import { eq, inArray, isNull } from "drizzle-orm";

export {
  EMAIL_ROLE_LABELS,
  excludeActorRecipients,
  filterRecipientsByRole,
  mergeEmailRecipients,
  roleLabel,
  withRoleLabels,
} from "$lib/email/recipient-merge";
export type {
  EmailPartyRole,
  EmailRecipientSeed,
  LoanEmailRecipient,
} from "$lib/email/recipient-merge";

function addRecipient(
  list: EmailRecipientSeed[],
  input: {
    email: string | null | undefined;
    userId?: string | null;
    name: string;
    role: EmailPartyRole;
  },
): void {
  const email = normalizeEmail(input.email);
  if (!email) return;
  list.push({
    email,
    userId: input.userId ?? null,
    name: input.name.trim(),
    roles: [input.role],
  });
}

/**
 * Every party on a loan: owner, borrower, investors, witnesses, and any signing
 * invitation email that is not already covered by a CRM row.
 */
export async function loadLoanEmailRecipients(
  loanId: number,
): Promise<LoanEmailRecipient[]> {
  const map = await loadLoanEmailRecipientsForLoans([loanId]);
  return map.get(loanId) ?? [];
}

function recipientsFromLoanRow(
  loan: Awaited<ReturnType<typeof loadLoanRows>>[number],
): LoanEmailRecipient[] {
  const seeds: EmailRecipientSeed[] = [];

  addRecipient(seeds, {
    email: loan.user?.email,
    userId: loan.userId,
    name: loan.user?.name ?? "Owner",
    role: "owner",
  });

  addRecipient(seeds, {
    email: loan.borrower?.borrowerUser?.email ?? loan.borrower?.email,
    userId: loan.borrower?.borrowerUserId ?? loan.borrower?.borrowerUser?.id,
    name: loan.borrower?.name ?? "Borrower",
    role: "borrower",
  });

  for (const allocation of loan.loanInvestors) {
    addRecipient(seeds, {
      email:
        allocation.investor?.investorUser?.email ?? allocation.investor?.email,
      userId:
        allocation.investor?.investorUserId ??
        allocation.investor?.investorUser?.id,
      name: allocation.investor?.name ?? "Investor",
      role: "investor",
    });
  }

  for (const link of loan.loanWitnesses) {
    addRecipient(seeds, {
      email: link.witness?.witnessUser?.email ?? link.witness?.email,
      userId: link.witness?.witnessUserId ?? link.witness?.witnessUser?.id,
      name: link.witness?.name ?? "Witness",
      role: "witness",
    });
  }

  for (const invitation of loan.signingInvitations) {
    if (
      invitation.partyRole === "lender" &&
      invitation.investorId != null &&
      !loan.loanInvestors.some(
        (row) => row.investorId === invitation.investorId,
      )
    ) {
      continue;
    }
    if (
      (invitation.partyRole === "witness_1" ||
        invitation.partyRole === "witness_2") &&
      invitation.witnessId != null &&
      !loan.loanWitnesses.some((row) => row.witnessId === invitation.witnessId)
    ) {
      continue;
    }

    const role: EmailPartyRole =
      invitation.partyRole === "borrower"
        ? "borrower"
        : invitation.partyRole === "lender"
          ? "investor"
          : "witness";
    addRecipient(seeds, {
      email: invitation.partyEmail,
      name: invitation.partyName,
      role,
    });
  }

  return withRoleLabels(mergeEmailRecipients(seeds));
}

const RECIPIENT_LOAD_CHUNK = 400;

async function loadLoanRows(loanIds: number[]) {
  return db.query.loans.findMany({
    where: inArray(loans.id, loanIds),
    with: {
      user: true,
      borrower: { with: { borrowerUser: true } },
      loanInvestors: {
        where: isNull(loanInvestors.deletedAt),
        with: {
          investor: { with: { investorUser: true } },
        },
      },
      loanWitnesses: {
        with: {
          witness: { with: { witnessUser: true } },
        },
      },
      signingInvitations: true,
    },
  });
}

/**
 * Bulk recipient load for the daily reminder cron. One query per 400 loans
 * instead of one query per loan.
 */
export async function loadLoanEmailRecipientsForLoans(
  loanIds: number[],
): Promise<Map<number, LoanEmailRecipient[]>> {
  const unique = [...new Set(loanIds.filter((id) => Number.isFinite(id)))];
  const map = new Map<number, LoanEmailRecipient[]>();
  if (unique.length === 0) return map;

  for (let index = 0; index < unique.length; index += RECIPIENT_LOAD_CHUNK) {
    const chunk = unique.slice(index, index + RECIPIENT_LOAD_CHUNK);
    const rows = await loadLoanRows(chunk);
    for (const loan of rows) {
      map.set(loan.id, recipientsFromLoanRow(loan));
    }
  }
  for (const loanId of unique) {
    if (!map.has(loanId)) map.set(loanId, []);
  }
  return map;
}

/** Group creator plus every derived group member. */
export async function loadGroupEmailRecipients(
  groupId: number,
): Promise<LoanEmailRecipient[]> {
  const [group, members] = await Promise.all([
    db.query.loanGroups.findFirst({
      where: eq(loanGroups.id, groupId),
      with: { creator: true },
    }),
    db
      .select({
        userId: loanGroupMembers.userId,
        partyRoles: loanGroupMembers.partyRoles,
        name: users.name,
        email: users.email,
      })
      .from(loanGroupMembers)
      .innerJoin(users, eq(loanGroupMembers.userId, users.id))
      .where(eq(loanGroupMembers.groupId, groupId)),
  ]);

  const seeds: EmailRecipientSeed[] = [];

  if (group?.creator) {
    addRecipient(seeds, {
      email: group.creator.email,
      userId: group.creator.id,
      name: group.creator.name ?? "Group owner",
      role: "owner",
    });
  }

  for (const member of members) {
    const roles = (member.partyRoles ?? [])
      .map((role) => role as EmailPartyRole)
      .filter((role): role is EmailPartyRole =>
        ["owner", "borrower", "investor", "witness"].includes(role),
      );
    addRecipient(seeds, {
      email: member.email,
      userId: member.userId,
      name: member.name ?? "Member",
      role: roles[0] ?? "owner",
    });
  }

  return withRoleLabels(mergeEmailRecipients(seeds));
}

export async function loadActorIdentity(
  actorUserId: string | null | undefined,
): Promise<{
  userId: string | null;
  email: string | null;
  name: string | null;
}> {
  if (!actorUserId) return { userId: null, email: null, name: null };
  const user = await db.query.users.findFirst({
    where: eq(users.id, actorUserId),
    columns: { id: true, email: true, name: true },
  });
  return {
    userId: user?.id ?? actorUserId,
    email: user?.email ?? null,
    name: user?.name ?? null,
  };
}
