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
} from "$lib/server/db/schema";
import { eq, and, or, isNotNull, inArray } from "drizzle-orm";
import { loadLinkedInvestorContactIds } from "$lib/server/party-investor-links";
import type { SigningPartyRole } from "$lib/loan-signing";
import { emailsMatch, normalizeEmail } from "$lib/loan-signing";
import type { LoanAccessContext, LoanMembership } from "$lib/loan-access";

export type { LoanAccessContext, LoanMembership };

/** View access for any loan party. Prefer getLoanAccessContext for writes/UI. */
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
  const empty: LoanAccessContext = {
    memberships: [],
    canView: false,
    canAdminEdit: false,
    editableInvestorIds: [],
    signingPartyRoles: [],
    linkedInvestorId: null,
  };

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
      },
    }),
  ]);

  if (!loan) return empty;

  const sessionEmail = sessionUser?.email ?? null;
  const memberships = new Set<LoanMembership>();
  const signingPartyRoles = new Set<SigningPartyRole>();
  let linkedInvestorId: number | null = null;

  const emailMatchesParty = (partyEmail: string | null | undefined) =>
    !!sessionEmail && emailsMatch(sessionEmail, partyEmail);

  if (loan.userId === userId) {
    memberships.add("owner");
  }

  for (const li of loan.loanInvestors) {
    if (li.investor?.investorUserId === userId) {
      memberships.add("investor");
      linkedInvestorId = li.investorId;
      signingPartyRoles.add("lender");
    }
  }

  if (
    loan.borrower?.borrowerUserId === userId ||
    emailMatchesParty(loan.borrower?.email)
  ) {
    if (
      loan.borrower?.borrowerUserId === userId ||
      emailMatchesParty(loan.borrower?.email)
    ) {
      memberships.add("borrower");
      signingPartyRoles.add("borrower");
    }
  }

  for (const invitation of loan.signingInvitations ?? []) {
    const witnessLinked = invitation.witness?.witnessUserId === userId;
    const emailLinked = emailMatchesParty(invitation.partyEmail);

    if (
      invitation.partyRole === "witness_1" ||
      invitation.partyRole === "witness_2"
    ) {
      if (witnessLinked || emailLinked) {
        memberships.add("witness");
        signingPartyRoles.add(invitation.partyRole);
      }
    }

    if (
      invitation.partyRole === "borrower" &&
      (loan.borrower?.borrowerUserId === userId || emailLinked)
    ) {
      memberships.add("borrower");
      signingPartyRoles.add("borrower");
    }

    if (invitation.partyRole === "lender") {
      const linkedByInvestor =
        !!invitation.investorId &&
        loan.loanInvestors.some(
          (li) =>
            li.investorId === invitation.investorId &&
            li.investor?.investorUserId === userId,
        );
      if (linkedByInvestor || emailLinked) {
        memberships.add("investor");
        signingPartyRoles.add("lender");
        if (invitation.investorId && linkedByInvestor) {
          linkedInvestorId = invitation.investorId;
        }
      }
    }
  }

  const witnessOnLoan = await db
    .select({ id: witnesses.id })
    .from(witnesses)
    .innerJoin(
      loanSigningInvitations,
      eq(loanSigningInvitations.witnessId, witnesses.id),
    )
    .where(
      and(
        eq(loanSigningInvitations.loanId, loanId),
        eq(witnesses.witnessUserId, userId),
      ),
    )
    .limit(1);
  if (witnessOnLoan.length > 0) {
    memberships.add("witness");
  }

  const list = [...memberships];
  const canAdminEdit = memberships.has("owner");

  return {
    memberships: list,
    canView: list.length > 0,
    canAdminEdit,
    editableInvestorIds: canAdminEdit
      ? loan.loanInvestors.map((li) => li.investorId)
      : [],
    signingPartyRoles: [...signingPartyRoles],
    linkedInvestorId,
  };
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
}> {
  const [
    userRow,
    ownedLoan,
    ownedInvestorContact,
    ownedBorrowerContact,
    ownedWitnessContact,
    investorLink,
    borrowerLink,
    witnessLink,
  ] = await Promise.all([
    db
      .select({ role: users.role })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1),
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

  const isAdminRole = userRow[0]?.role === "admin";

  return {
    isAdminWorkspace:
      isAdminRole ||
      ownedLoan.length > 0 ||
      ownedInvestorContact.length > 0 ||
      ownedBorrowerContact.length > 0 ||
      ownedWitnessContact.length > 0,
    hasInvestments: investorLink.length > 0,
    hasBorrowed: borrowerLink.length > 0,
    hasWitnessed: witnessLink.length > 0,
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
