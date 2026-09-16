import { eq } from "drizzle-orm";
import { db } from "$lib/server/db";
import { loans, users } from "$lib/server/db/schema";
import { stripDataImageUrls } from "$lib/json-safe-images";
import { computeLoanAccessContext } from "$lib/loan-access-compute";
import type { LoanAccessContext } from "$lib/loan-access";
import { listPaymentMethodsForBorrowerLoanView } from "$lib/server/payment-methods";
import type { LoanWithInvestors, PaymentMethod } from "$lib/types";
import {
  calculateTotalAmount,
  calculateTotalReceived,
  isLoanFullyReceived,
} from "$lib/calculations";
import { invalidateLoanData } from "$lib/server/cache-invalidation";

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
  const [sessionUser, entity] = await Promise.all([
    db.query.users.findFirst({
      where: eq(users.id, userId),
      columns: { email: true },
    }),
    db.query.loans.findFirst({
      where: eq(loans.id, loanId),
      with: {
        borrower: {
          columns: { ...partyColumns, notes: true, borrowerUserId: true },
        },
        loanInvestors: {
          with: {
            investor: { columns: { ...partyColumns, investorUserId: true } },
            interestPeriods: true,
            receivedPayments: true,
          },
        },
        loanWitnesses: {
          with: {
            witness: { columns: { ...partyColumns, witnessUserId: true } },
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
        transactions: {
          orderBy: (table, { asc }) => [asc(table.date)],
        },
        ...(options.includeContract ? { loanContract: true } : {}),
      },
    }),
  ]);

  if (!entity) return null;

  const access = computeLoanAccessContext(
    entity,
    userId,
    sessionUser?.email ?? null,
  );

  if (!access.canView) {
    const { getLoanGroupViewIds } = await import("$lib/server/access-control");
    const { projectLoanForGroupViewer } =
      await import("$lib/loan-group-viewer-projection");
    const viaGroupIds = await getLoanGroupViewIds(loanId, userId);
    if (viaGroupIds.length === 0) return null;

    const projected = projectLoanForGroupViewer(entity);
    return stripDataImageUrls({
      ...(projected as unknown as LoanWithInvestors),
      status: entity.status,
      access: {
        ...access,
        canView: true,
        canAdminEdit: false,
        viaGroupIds,
        isGroupViewer: true,
        editableInvestorIds: [],
      },
    });
  }

  let status = entity.status;
  if (
    status !== "Completed" &&
    isLoanFullyReceived(
      calculateTotalAmount(entity.loanInvestors),
      calculateTotalReceived(entity.loanInvestors),
    )
  ) {
    await db
      .update(loans)
      .set({ status: "Completed", updatedAt: new Date() })
      .where(eq(loans.id, loanId));
    status = "Completed";
    invalidateLoanData();
  }

  const paymentMethods = access.memberships.includes("borrower")
    ? await listPaymentMethodsForBorrowerLoanView(entity.userId, access)
    : [];

  return stripDataImageUrls({
    ...(entity as unknown as LoanWithInvestors),
    status,
    access: { ...access, viaGroupIds: [], isGroupViewer: false },
    ...(access.memberships.includes("borrower") ? { paymentMethods } : {}),
  });
}
