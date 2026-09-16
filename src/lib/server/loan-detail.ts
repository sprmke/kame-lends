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
import {
  finalizeLoansForViewer,
  hasPartyMembershipForCommission,
  stripLegacyCommissionFields,
} from "$lib/server/loan-user-commission";

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
            id: true,
            partyRole: true,
            partyEmail: true,
            investorId: true,
            witnessId: true,
            signedAt: true,
            expiresAt: true,
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
        groupLoans: { columns: { groupId: true, source: true } },
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
    const stripped = stripLegacyCommissionFields(
      projected as unknown as LoanWithInvestors,
    );
    return stripDataImageUrls({
      ...stripped,
      status: entity.status,
      myCommission: null,
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

  const [finalized] = await finalizeLoansForViewer(
    [entity as unknown as LoanWithInvestors],
    userId,
  );

  return stripDataImageUrls({
    ...finalized,
    status,
    myCommission:
      hasPartyMembershipForCommission(access) && !access.isGroupViewer
        ? (finalized.myCommission ?? null)
        : null,
    access: { ...access, viaGroupIds: [], isGroupViewer: false },
    ...(access.memberships.includes("borrower") ? { paymentMethods } : {}),
  });
}
