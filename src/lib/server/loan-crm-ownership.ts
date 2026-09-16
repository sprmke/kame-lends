import { and, eq, inArray } from "drizzle-orm";
import { db } from "$lib/server/db";
import { borrowers, investors } from "$lib/server/db/schema";

export type LoanCrmRefs = {
  borrowerId: number | null;
  investorIds: number[];
};

export type LoanCrmOwnershipResult =
  { ok: true } | { ok: false; status: 400 | 403 | 404; message: string };

/**
 * Ensures borrower and investors belong to the lending workspace owner (userId).
 */
export async function validateLoanCrmOwnership(
  userId: string,
  refs: LoanCrmRefs,
): Promise<LoanCrmOwnershipResult> {
  const investorIds = [
    ...new Set(
      refs.investorIds
        .map((id) => Number(id))
        .filter((id) => Number.isFinite(id) && id > 0),
    ),
  ];
  if (investorIds.length === 0) {
    return {
      ok: false,
      status: 400,
      message: "At least one investor is required",
    };
  }

  if (refs.borrowerId != null) {
    const borrowerId = Number(refs.borrowerId);
    if (!Number.isFinite(borrowerId)) {
      return { ok: false, status: 400, message: "Invalid borrower" };
    }
    const borrower = await db.query.borrowers.findFirst({
      where: and(eq(borrowers.id, borrowerId), eq(borrowers.userId, userId)),
      columns: { id: true },
    });
    if (!borrower) {
      return { ok: false, status: 404, message: "Borrower not found" };
    }
  }

  const ownedInvestors = await db
    .select({ id: investors.id })
    .from(investors)
    .where(
      and(inArray(investors.id, investorIds), eq(investors.userId, userId)),
    );

  if (ownedInvestors.length !== investorIds.length) {
    return {
      ok: false,
      status: 403,
      message: "One or more investors are not in your workspace",
    };
  }

  return { ok: true };
}
