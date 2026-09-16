import { and, eq, inArray } from "drizzle-orm";
import { db } from "$lib/server/db";
import { loanUserCommissions } from "$lib/server/db/schema";
import type { LoanAccessContext } from "$lib/loan-access";
import type {
  InterestType,
  LoanUserCommission,
  LoanWithInvestors,
} from "$lib/types";

const DEFAULT_COMMISSION: LoanUserCommission = {
  profitType: "rate",
  profitValue: "0",
};

export function hasPartyMembershipForCommission(
  access: LoanAccessContext,
): boolean {
  return access.memberships.some(
    (role) => role === "borrower" || role === "investor" || role === "witness",
  );
}

export async function hasMyCommissionAccess(
  loanId: number,
  userId: string,
): Promise<boolean> {
  const { getLoanAccessContext } = await import("$lib/server/access-control");
  const access = await getLoanAccessContext(loanId, userId);
  if (!access.canView || access.isGroupViewer) return false;
  return hasPartyMembershipForCommission(access);
}

function toCommissionRow(
  row: typeof loanUserCommissions.$inferSelect | undefined,
): LoanUserCommission | null {
  if (!row) return null;
  return {
    profitType: row.profitType as InterestType,
    profitValue: row.profitValue,
  };
}

export async function getUserCommissionForLoan(
  loanId: number,
  userId: string,
): Promise<LoanUserCommission | null> {
  const row = await db.query.loanUserCommissions.findFirst({
    where: and(
      eq(loanUserCommissions.loanId, loanId),
      eq(loanUserCommissions.userId, userId),
    ),
  });
  return toCommissionRow(row);
}

export async function loadUserCommissionsForLoanIds(
  userId: string,
  loanIds: number[],
): Promise<Map<number, LoanUserCommission>> {
  const uniqueIds = [...new Set(loanIds)];
  if (uniqueIds.length === 0) return new Map();

  const rows = await db.query.loanUserCommissions.findMany({
    where: and(
      eq(loanUserCommissions.userId, userId),
      inArray(loanUserCommissions.loanId, uniqueIds),
    ),
  });

  const map = new Map<number, LoanUserCommission>();
  for (const row of rows) {
    map.set(row.loanId, {
      profitType: row.profitType as InterestType,
      profitValue: row.profitValue,
    });
  }
  return map;
}

export async function upsertUserCommission(
  loanId: number,
  userId: string,
  input: { profitType: InterestType; profitValue: string },
): Promise<LoanUserCommission> {
  const now = new Date();
  const [row] = await db
    .insert(loanUserCommissions)
    .values({
      loanId,
      userId,
      profitType: input.profitType,
      profitValue: input.profitValue,
      createdAt: now,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: [loanUserCommissions.loanId, loanUserCommissions.userId],
      set: {
        profitType: input.profitType,
        profitValue: input.profitValue,
        updatedAt: now,
      },
    })
    .returning();

  return {
    profitType: row.profitType as InterestType,
    profitValue: row.profitValue,
  };
}

/** Remove legacy commission fields from loan payloads sent to clients. */
export function stripLegacyCommissionFields<T extends LoanWithInvestors>(
  loan: T,
): T {
  return {
    ...loan,
    profitType: DEFAULT_COMMISSION.profitType,
    profitValue: DEFAULT_COMMISSION.profitValue,
    loanInvestors: loan.loanInvestors.map((allocation) => ({
      ...allocation,
      profitType: DEFAULT_COMMISSION.profitType,
      profitValue: DEFAULT_COMMISSION.profitValue,
    })),
    loanWitnesses: (loan.loanWitnesses ?? []).map((witnessRow) => ({
      ...witnessRow,
      profitType: DEFAULT_COMMISSION.profitType,
      profitValue: DEFAULT_COMMISSION.profitValue,
    })),
  };
}

export async function finalizeLoansForViewer<T extends LoanWithInvestors>(
  loans: T[],
  userId: string,
): Promise<T[]> {
  const commissionMap = await loadUserCommissionsForLoanIds(
    userId,
    loans.map((loan) => loan.id),
  );

  return loans.map((loan) => {
    const stripped = stripLegacyCommissionFields(loan);
    const myCommission = commissionMap.get(loan.id) ?? null;
    return { ...stripped, myCommission };
  });
}
