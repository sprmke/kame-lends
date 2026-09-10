import { and, eq, or, sql } from "drizzle-orm";
import { db } from "$lib/server/db";
import {
  borrowers,
  investors,
  loanInvestors,
  loans,
  loanSigningInvitations,
  transactions,
  witnesses,
} from "$lib/server/db/schema";
import { normalizeEmail } from "$lib/loan-signing";
import type { NavCapabilities } from "$lib/nav/app-nav";

/** Party roles earned from loans and transactions, not the single `users.role` column. */
export async function loadPartyActivityRoles(
  userId: string,
  email?: string | null,
): Promise<
  Pick<NavCapabilities, "hasInvestments" | "hasBorrowed" | "hasWitnessed">
> {
  const normalizedEmail = normalizeEmail(email);

  const [
    investorOnLoan,
    investorOnTransaction,
    borrowerOnLoan,
    witnessById,
    witnessByEmail,
  ] = await Promise.all([
    db
      .select({ id: loanInvestors.id })
      .from(loanInvestors)
      .innerJoin(investors, eq(loanInvestors.investorId, investors.id))
      .where(eq(investors.investorUserId, userId))
      .limit(1),
    db
      .select({ id: transactions.id })
      .from(transactions)
      .innerJoin(investors, eq(transactions.investorId, investors.id))
      .where(eq(investors.investorUserId, userId))
      .limit(1),
    db
      .select({ id: loans.id })
      .from(loans)
      .innerJoin(borrowers, eq(loans.borrowerId, borrowers.id))
      .where(eq(borrowers.borrowerUserId, userId))
      .limit(1),
    db
      .select({ id: loanSigningInvitations.id })
      .from(loanSigningInvitations)
      .innerJoin(witnesses, eq(loanSigningInvitations.witnessId, witnesses.id))
      .where(eq(witnesses.witnessUserId, userId))
      .limit(1),
    normalizedEmail
      ? db
          .select({ id: loanSigningInvitations.id })
          .from(loanSigningInvitations)
          .where(
            and(
              sql`lower(${loanSigningInvitations.partyEmail}) = ${normalizedEmail}`,
              or(
                eq(loanSigningInvitations.partyRole, "witness_1"),
                eq(loanSigningInvitations.partyRole, "witness_2"),
              ),
            ),
          )
          .limit(1)
      : Promise.resolve([]),
  ]);

  return {
    hasInvestments:
      investorOnLoan.length > 0 || investorOnTransaction.length > 0,
    hasBorrowed: borrowerOnLoan.length > 0,
    hasWitnessed: witnessById.length > 0 || witnessByEmail.length > 0,
  };
}
