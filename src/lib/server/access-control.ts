import { db } from "$lib/server/db";
import {
  loans,
  loanInvestors,
  investors,
  borrowers,
  witnesses,
  loanSigningInvitations,
  transactions,
  debts,
  users,
  loanGroupLoans,
  loanGroupMembers,
} from "$lib/server/db/schema";
import { eq, and, or, isNotNull, inArray } from "drizzle-orm";
import { loadLinkedInvestorContactIds } from "$lib/server/party-investor-links";
import { emailsMatch, normalizeEmail } from "$lib/loan-signing";
import type { LoanAccessContext, LoanMembership } from "$lib/loan-access";
import {
  computeLoanAccessContext,
  emptyLoanAccess,
} from "$lib/loan-access-compute";

export type { LoanAccessContext, LoanMembership };
export { computeLoanAccessContext };
export async function hasLoanAccess(
  loanId: number,
  userId: string,
): Promise<boolean> {
  return hasLoanViewAccess(loanId, userId);
}

export async function hasLoanViewAccess(
  loanId: number,
  userId: string,
): Promise<boolean> {
  const ownerOrInvestor = await db
    .select({ id: loans.id })
    .from(loans)
    .leftJoin(investors, eq(investors.investorUserId, userId))
    .leftJoin(
      loanInvestors,
      and(
        eq(loanInvestors.loanId, loans.id),
        eq(loanInvestors.investorId, investors.id),
      ),
    )
    .where(
      and(
        eq(loans.id, loanId),
        or(eq(loans.userId, userId), isNotNull(loanInvestors.id)),
      ),
    )
    .limit(1);
  if (ownerOrInvestor.length > 0) return true;

  const asBorrower = await db
    .select({ id: loans.id })
    .from(loans)
    .innerJoin(borrowers, eq(borrowers.id, loans.borrowerId))
    .where(and(eq(loans.id, loanId), eq(borrowers.borrowerUserId, userId)))
    .limit(1);
  if (asBorrower.length > 0) return true;

  const asWitnessById = await db
    .select({ id: loanSigningInvitations.id })
    .from(loanSigningInvitations)
    .innerJoin(witnesses, eq(witnesses.id, loanSigningInvitations.witnessId))
    .where(
      and(
        eq(loanSigningInvitations.loanId, loanId),
        eq(witnesses.witnessUserId, userId),
      ),
    )
    .limit(1);
  if (asWitnessById.length > 0) return true;

  const user = await db.query.users.findFirst({ where: eq(users.id, userId) });
  const email = normalizeEmail(user?.email);
  if (!email) return false;

  const asWitnessByEmail = await db
    .select({ id: loanSigningInvitations.id })
    .from(loanSigningInvitations)
    .where(
      and(
        eq(loanSigningInvitations.loanId, loanId),
        eq(loanSigningInvitations.partyEmail, email),
        or(
          eq(loanSigningInvitations.partyRole, "witness_1"),
          eq(loanSigningInvitations.partyRole, "witness_2"),
        ),
      ),
    )
    .limit(1);
  return asWitnessByEmail.length > 0;
}

export async function hasLoanAdminAccess(
  loanId: number,
  userId: string,
): Promise<boolean> {
  const rows = await db
    .select({ id: loans.id })
    .from(loans)
    .where(and(eq(loans.id, loanId), eq(loans.userId, userId)))
    .limit(1);
  return rows.length > 0;
}

/**
 * Group membership grants read-only loan view. Separate from hasLoanViewAccess
 * so payment/contract/storage endpoints stay party-only.
 */
export async function hasLoanGroupViewAccess(
  loanId: number,
  userId: string,
): Promise<boolean> {
  const rows = await db
    .select({ groupId: loanGroupLoans.groupId })
    .from(loanGroupLoans)
    .innerJoin(
      loanGroupMembers,
      and(
        eq(loanGroupMembers.groupId, loanGroupLoans.groupId),
        eq(loanGroupMembers.userId, userId),
      ),
    )
    .where(eq(loanGroupLoans.loanId, loanId))
    .limit(1);
  return rows.length > 0;
}

export async function getLoanGroupViewIds(
  loanId: number,
  userId: string,
): Promise<number[]> {
  const rows = await db
    .select({ groupId: loanGroupLoans.groupId })
    .from(loanGroupLoans)
    .innerJoin(
      loanGroupMembers,
      and(
        eq(loanGroupMembers.groupId, loanGroupLoans.groupId),
        eq(loanGroupMembers.userId, userId),
      ),
    )
    .where(eq(loanGroupLoans.loanId, loanId));
  return [...new Set(rows.map((r) => r.groupId))];
}

/** Writes to an allocation. Workspace owners only. Party investors are read-only. */
export async function hasInvestorAllocationAccess(
  loanId: number,
  userId: string,
  _investorId: number,
): Promise<boolean> {
  return hasLoanAdminAccess(loanId, userId);
}

export async function resolveLoanMemberships(
  loanId: number,
  userId: string,
): Promise<LoanMembership[]> {
  const ctx = await getLoanAccessContext(loanId, userId);
  return ctx.memberships;
}

export async function getLoanAccessContext(
  loanId: number,
  userId: string,
): Promise<LoanAccessContext> {
  const [sessionUser, loan] = await Promise.all([
    db.query.users.findFirst({
      where: eq(users.id, userId),
      columns: { id: true, email: true },
    }),
    db.query.loans.findFirst({
      where: eq(loans.id, loanId),
      columns: { id: true, userId: true, borrowerId: true },
      with: {
        borrower: { columns: { id: true, borrowerUserId: true, email: true } },
        loanInvestors: {
          columns: { investorId: true },
          with: {
            investor: {
              columns: { id: true, investorUserId: true, email: true },
            },
          },
        },
        signingInvitations: {
          columns: {
            partyRole: true,
            partyEmail: true,
            investorId: true,
            witnessId: true,
          },
          with: {
            witness: {
              columns: { id: true, witnessUserId: true, email: true },
            },
          },
        },
        loanWitnesses: {
          columns: { id: true, witnessId: true },
          with: {
            witness: {
              columns: { id: true, witnessUserId: true, email: true },
            },
          },
        },
      },
    }),
  ]);

  if (!loan) return emptyLoanAccess;
  return computeLoanAccessContext(loan, userId, sessionUser?.email ?? null);
}

/** @deprecated Use hasMyCommissionAccess from loan-user-commission.ts */
export async function hasBorrowerProfitWriteAccess(
  loanId: number,
  userId: string,
): Promise<boolean> {
  const { hasMyCommissionAccess } =
    await import("$lib/server/loan-user-commission");
  return hasMyCommissionAccess(loanId, userId);
}

/** @deprecated Commission is private per user via loan_user_commissions */
export async function resolveWitnessProfitWriteAccess(
  _loanId: number,
  _userId: string,
  _witnessLoanId: number,
): Promise<boolean> {
  return false;
}

/** @deprecated Commission is private per user via loan_user_commissions */
export async function resolveInvestorCommissionWriteAccess(
  _loanId: number,
  _userId: string,
  _loanInvestorId: number,
): Promise<boolean> {
  return false;
}

/** True when this witness contact was created by (and thus is manageable by) this workspace owner. */
export async function isOwnedWitness(
  witnessId: number,
  userId: string,
): Promise<boolean> {
  const rows = await db
    .select({ id: witnesses.id })
    .from(witnesses)
    .where(and(eq(witnesses.id, witnessId), eq(witnesses.userId, userId)))
    .limit(1);
  return rows.length > 0;
}

export async function hasBorrowerContactViewAccess(
  borrowerId: number,
  userId: string,
): Promise<boolean> {
  const rows = await db
    .select({ id: borrowers.id })
    .from(borrowers)
    .where(
      and(
        eq(borrowers.id, borrowerId),
        or(eq(borrowers.userId, userId), eq(borrowers.borrowerUserId, userId)),
      ),
    )
    .limit(1);
  return rows.length > 0;
}

export async function hasWitnessContactViewAccess(
  witnessId: number,
  userId: string,
): Promise<boolean> {
  const rows = await db
    .select({ id: witnesses.id })
    .from(witnesses)
    .where(
      and(
        eq(witnesses.id, witnessId),
        or(eq(witnesses.userId, userId), eq(witnesses.witnessUserId, userId)),
      ),
    )
    .limit(1);
  return rows.length > 0;
}

export async function hasInvestorContactViewAccess(
  investorId: number,
  userId: string,
): Promise<boolean> {
  const contact = await db
    .select({
      id: investors.id,
      userId: investors.userId,
      investorUserId: investors.investorUserId,
    })
    .from(investors)
    .where(eq(investors.id, investorId))
    .limit(1);
  const row = contact[0];
  if (!row) return false;
  if (row.userId === userId || row.investorUserId === userId) return true;

  const myIds = await loadLinkedInvestorContactIds(userId);
  if (myIds.length === 0) return false;

  const myLoans = await db
    .select({ loanId: loanInvestors.loanId })
    .from(loanInvestors)
    .where(inArray(loanInvestors.investorId, myIds));
  const loanIds = [...new Set(myLoans.map((item) => item.loanId))];
  if (loanIds.length === 0) return false;

  const shared = await db
    .select({ id: loanInvestors.id })
    .from(loanInvestors)
    .where(
      and(
        eq(loanInvestors.investorId, investorId),
        inArray(loanInvestors.loanId, loanIds),
      ),
    )
    .limit(1);
  return shared.length > 0;
}

export async function getNavCapabilities(userId: string): Promise<{
  isAdminWorkspace: boolean;
  hasInvestments: boolean;
  hasBorrowed: boolean;
  hasWitnessed: boolean;
  hasGroups: boolean;
}> {
  const [
    ownedLoan,
    ownedInvestorContact,
    ownedBorrowerContact,
    ownedWitnessContact,
    ownedDebt,
    investorLink,
    borrowerLink,
    witnessLink,
  ] = await Promise.all([
    db
      .select({ id: loans.id })
      .from(loans)
      .where(eq(loans.userId, userId))
      .limit(1),
    db
      .select({ id: investors.id })
      .from(investors)
      .where(eq(investors.userId, userId))
      .limit(1),
    db
      .select({ id: borrowers.id })
      .from(borrowers)
      .where(eq(borrowers.userId, userId))
      .limit(1),
    db
      .select({ id: witnesses.id })
      .from(witnesses)
      .where(eq(witnesses.userId, userId))
      .limit(1),
    db
      .select({ id: debts.id })
      .from(debts)
      .where(eq(debts.userId, userId))
      .limit(1),
    db
      .select({ id: investors.id })
      .from(investors)
      .where(eq(investors.investorUserId, userId))
      .limit(1),
    db
      .select({ id: borrowers.id })
      .from(borrowers)
      .where(eq(borrowers.borrowerUserId, userId))
      .limit(1),
    db
      .select({ id: witnesses.id })
      .from(witnesses)
      .where(eq(witnesses.witnessUserId, userId))
      .limit(1),
  ]);

  const isAdminWorkspace =
    ownedLoan.length > 0 ||
    ownedInvestorContact.length > 0 ||
    ownedBorrowerContact.length > 0 ||
    ownedWitnessContact.length > 0 ||
    ownedDebt.length > 0;

  return {
    isAdminWorkspace,
    hasInvestments: investorLink.length > 0,
    hasBorrowed: borrowerLink.length > 0,
    hasWitnessed: witnessLink.length > 0,
    // Layout still gates with SHOW_GROUPS_UI. Any signed-in user may open Groups.
    hasGroups: true,
  };
}

export async function hasTransactionAccess(
  transactionId: number,
  userId: string,
): Promise<boolean> {
  const rows = await db
    .select({ id: transactions.id })
    .from(transactions)
    .leftJoin(
      investors,
      and(
        eq(investors.id, transactions.investorId),
        eq(investors.investorUserId, userId),
      ),
    )
    .where(
      and(
        eq(transactions.id, transactionId),
        or(eq(transactions.userId, userId), isNotNull(investors.id)),
      ),
    )
    .limit(1);

  return rows.length > 0;
}

export async function hasDebtAccess(
  debtId: number,
  userId: string,
): Promise<boolean> {
  const rows = await db
    .select({ id: debts.id })
    .from(debts)
    .leftJoin(
      investors,
      and(
        eq(investors.id, debts.investorId),
        eq(investors.investorUserId, userId),
      ),
    )
    .where(
      and(
        eq(debts.id, debtId),
        or(eq(debts.userId, userId), isNotNull(investors.id)),
      ),
    )
    .limit(1);

  return rows.length > 0;
}

export { normalizeEmail, emailsMatch };
