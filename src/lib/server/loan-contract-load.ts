import { eq } from "drizzle-orm";
import { db } from "$lib/server/db";
import { loans, users } from "$lib/server/db/schema";
import { computeLoanAccessContext } from "$lib/loan-access-compute";
import type { LoanAccessContext } from "$lib/loan-access";

const contractLoanWith = {
  borrower: true,
  loanContract: true,
  signingInvitations: true,
  loanWitnesses: {
    with: {
      witness: true,
    },
  },
  loanInvestors: {
    with: {
      investor: true,
      interestPeriods: true,
      receivedPayments: true,
    },
  },
} as const;

export async function loadLoanForContractAccess(
  loanId: number,
  userId: string,
) {
  const [sessionUser, loan] = await Promise.all([
    db.query.users.findFirst({
      where: eq(users.id, userId),
      columns: { email: true },
    }),
    db.query.loans.findFirst({
      where: eq(loans.id, loanId),
      with: contractLoanWith,
    }),
  ]);

  if (!loan) return null;

  const access: LoanAccessContext = computeLoanAccessContext(
    loan,
    userId,
    sessionUser?.email ?? null,
  );
  if (!access.canView) return null;

  return { loan, access };
}
