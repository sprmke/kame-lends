import { and, eq, inArray } from "drizzle-orm";
import { db } from "$lib/server/db";
import {
  borrowers,
  investors,
  loanInvestors,
  loans,
} from "$lib/server/db/schema";

export interface ReceiptScanPartyRefs {
  loanId?: number;
  investorIds?: number[];
  borrowerId?: number;
}

export interface ReceiptScanParties {
  lenderNames: string[];
  borrowerName: string | null;
}

/**
 * Resolves lender/borrower names used as prompt hints. Names come only from the
 * signed-in owner's CRM — never from client free text — so the prompt cannot be
 * stuffed with arbitrary strings.
 */
export async function resolveReceiptScanParties(
  userId: string,
  refs: ReceiptScanPartyRefs,
): Promise<ReceiptScanParties> {
  const lenderNames = new Set<string>();
  let borrowerName: string | null = null;

  if (refs.loanId) {
    const [loan] = await db
      .select({ borrowerName: borrowers.name })
      .from(loans)
      .leftJoin(borrowers, eq(borrowers.id, loans.borrowerId))
      .where(and(eq(loans.id, refs.loanId), eq(loans.userId, userId)))
      .limit(1);
    if (loan) {
      borrowerName = loan.borrowerName ?? null;
      const rows = await db
        .selectDistinct({ name: investors.name })
        .from(loanInvestors)
        .innerJoin(investors, eq(investors.id, loanInvestors.investorId))
        .where(eq(loanInvestors.loanId, refs.loanId));
      rows.forEach((row) => lenderNames.add(row.name));
    }
  }

  const investorIds = [...new Set(refs.investorIds ?? [])].slice(0, 20);
  if (investorIds.length > 0) {
    const rows = await db
      .select({ name: investors.name })
      .from(investors)
      .where(
        and(inArray(investors.id, investorIds), eq(investors.userId, userId)),
      );
    rows.forEach((row) => lenderNames.add(row.name));
  }

  if (refs.borrowerId && !borrowerName) {
    const [row] = await db
      .select({ name: borrowers.name })
      .from(borrowers)
      .where(
        and(eq(borrowers.id, refs.borrowerId), eq(borrowers.userId, userId)),
      )
      .limit(1);
    borrowerName = row?.name ?? null;
  }

  return { lenderNames: [...lenderNames].slice(0, 20), borrowerName };
}
