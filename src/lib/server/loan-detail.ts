import { eq } from "drizzle-orm";
import { db } from "$lib/server/db";
import { loans } from "$lib/server/db/schema";
import { stripDataImageUrls } from "$lib/json-safe-images";
import {
  getLoanAccessContext,
  type LoanAccessContext,
} from "$lib/server/access-control";
import { listPaymentMethodsForBorrowerLoanView } from "$lib/server/payment-methods";
import type { LoanWithInvestors, PaymentMethod } from "$lib/types";

const partyColumns = {
  id: true,
  name: true,
  email: true,
  contactNumber: true,
  address: true,
  validIdUrl: true,
  eSignatureUrl: true,
  createdAt: true,
  updatedAt: true,
} as const;

export type LoanDetailPayload = LoanWithInvestors & {
  access: LoanAccessContext;
  paymentMethods?: PaymentMethod[];
};

export async function loadLoanDetail(
  loanId: number,
  userId: string,
  options: { includeContract?: boolean } = {},
): Promise<LoanDetailPayload | null> {
  const access = await getLoanAccessContext(loanId, userId);
  if (!access.canView) return null;

  const entity = await db.query.loans.findFirst({
    where: eq(loans.id, loanId),
    with: {
      borrower: { columns: { ...partyColumns, notes: true } },
      loanInvestors: {
        with: {
          investor: { columns: partyColumns },
          interestPeriods: true,
          receivedPayments: true,
        },
      },
      loanWitnesses: {
        with: {
          witness: { columns: partyColumns },
        },
      },
      transactions: {
        orderBy: (table, { asc }) => [asc(table.date)],
      },
      ...(options.includeContract ? { loanContract: true } : {}),
    },
  });

  if (!entity) return null;

  const paymentMethods = await listPaymentMethodsForBorrowerLoanView(
    entity.userId,
    access,
  );

  return stripDataImageUrls({
    ...(entity as unknown as LoanWithInvestors),
    access,
    ...(access.memberships.includes("borrower") ? { paymentMethods } : {}),
  });
}
