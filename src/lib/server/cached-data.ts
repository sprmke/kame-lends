import { and, eq, inArray, or } from "drizzle-orm";
import { db } from "$lib/server/db";
import { remember } from "$lib/server/memory-cache";
import {
  loadInvestmentLoanIds,
  loadLinkedInvestorContactIds,
} from "$lib/server/party-investor-links";
import {
  borrowers,
  debts,
  investors,
  loanInvestors,
  loanSigningInvitations,
  loans,
  transactions,
  witnesses,
} from "$lib/server/db/schema";

export type LoanCacheMode = "full" | "list";
export type InvestorCacheMode = "simple" | "list" | "full";
export type LoanListScope =
  "owned" | "investments" | "borrowed" | "witnessed" | "all";

const listRelations = {
  loanInvestors: {
    with: {
      investor: { columns: { id: true, name: true } },
      interestPeriods: {
        columns: { interestRate: true, interestType: true, dueDate: true },
      },
    },
  },
  signingInvitations: {
    columns: { witnessId: true, partyRole: true },
    with: {
      witness: { columns: { id: true, name: true } },
    },
  },
} as const;

const fullRelations = {
  borrower: true,
  loanInvestors: {
    with: {
      investor: true,
      interestPeriods: true,
      receivedPayments: true,
    },
  },
} as const;

export async function getCachedLoans(
  userId: string,
  mode: LoanCacheMode = "full",
) {
  const cacheKey = mode === "list" ? `loans:list:${userId}` : `loans:${userId}`;
  return remember(cacheKey, () => loadLoans(userId, mode, "all"));
}

export async function getCachedLoansByScope(
  userId: string,
  scope: LoanListScope,
  mode: LoanCacheMode = "list",
) {
  return remember(`loans:${scope}:${mode}:${userId}`, () =>
    loadLoans(userId, mode, scope),
  );
}

async function loadLoansByIds(ids: number[], mode: LoanCacheMode) {
  if (ids.length === 0) return [];
  return mode === "list"
    ? db.query.loans.findMany({
        where: inArray(loans.id, ids),
        with: listRelations,
      })
    : db.query.loans.findMany({
        where: inArray(loans.id, ids),
        with: fullRelations,
      });
}

async function loadOwnedLoanIds(userId: string) {
  const rows = await db
    .select({ id: loans.id })
    .from(loans)
    .where(eq(loans.userId, userId));
  return rows.map((r) => r.id);
}

async function loadBorrowedLoanIds(userId: string) {
  const borrowerRecords = await db.query.borrowers.findMany({
    where: eq(borrowers.borrowerUserId, userId),
    columns: { id: true },
  });
  if (borrowerRecords.length === 0) return [];
  const borrowerIds = borrowerRecords.map((b) => b.id);
  const rows = await db
    .select({ id: loans.id })
    .from(loans)
    .where(inArray(loans.borrowerId, borrowerIds));
  return rows.map((r) => r.id);
}

async function loadWitnessedLoanIds(userId: string) {
  const witnessRecords = await db.query.witnesses.findMany({
    where: eq(witnesses.witnessUserId, userId),
    columns: { id: true },
  });
  if (witnessRecords.length === 0) return [];
  const witnessIds = witnessRecords.map((w) => w.id);
  const rows = await db
    .select({ loanId: loanSigningInvitations.loanId })
    .from(loanSigningInvitations)
    .where(inArray(loanSigningInvitations.witnessId, witnessIds));
  return [...new Set(rows.map((r) => r.loanId))];
}

async function loadLoans(
  userId: string,
  mode: LoanCacheMode,
  scope: LoanListScope,
) {
  let ids: number[] = [];

  if (scope === "owned") {
    ids = await loadOwnedLoanIds(userId);
  } else if (scope === "investments") {
    ids = await loadInvestmentLoanIds(userId);
  } else if (scope === "borrowed") {
    ids = await loadBorrowedLoanIds(userId);
  } else if (scope === "witnessed") {
    ids = await loadWitnessedLoanIds(userId);
  } else {
    const [owned, invested, borrowed, witnessed] = await Promise.all([
      loadOwnedLoanIds(userId),
      loadInvestmentLoanIds(userId),
      loadBorrowedLoanIds(userId),
      loadWitnessedLoanIds(userId),
    ]);
    ids = [...new Set([...owned, ...invested, ...borrowed, ...witnessed])];
  }

  const result = await loadLoansByIds(ids, mode);
  return result.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
}

export async function getCachedInvestors(
  userId: string,
  mode: InvestorCacheMode | boolean = "full",
) {
  const resolved: InvestorCacheMode =
    typeof mode === "boolean" ? (mode ? "simple" : "full") : mode;
  return remember(`investors:${userId}:${resolved}`, () =>
    loadInvestors(userId, resolved),
  );
}

const investorSimpleColumns = {
  id: true,
  name: true,
  email: true,
  contactNumber: true,
  address: true,
  validIdUrl: true,
  eSignatureUrl: true,
} as const;

const investorListRelations = {
  loanInvestors: {
    with: {
      loan: { columns: { id: true, status: true } },
      interestPeriods: {
        columns: {
          interestRate: true,
          interestType: true,
          dueDate: true,
        },
      },
    },
  },
  transactions: { columns: { date: true, balance: true } },
} as const;

const investorFullRelations = {
  loanInvestors: { with: { loan: true } },
  transactions: true,
} as const;

function loadInvestorsByWhere(
  where: ReturnType<typeof eq> | ReturnType<typeof inArray>,
  mode: InvestorCacheMode,
) {
  if (mode === "simple") {
    return db.query.investors.findMany({
      where,
      columns: investorSimpleColumns,
    });
  }
  if (mode === "list") {
    return db.query.investors.findMany({
      where,
      with: investorListRelations,
    });
  }
  return db.query.investors.findMany({
    where,
    with: investorFullRelations,
  });
}

async function loadInvestors(userId: string, mode: InvestorCacheMode) {
  const ownedInvestors = await loadInvestorsByWhere(
    eq(investors.userId, userId),
    mode,
  );

  const linkedInvestorIds = await loadLinkedInvestorContactIds(userId);
  if (linkedInvestorIds.length === 0) return ownedInvestors;

  const sharedLinks = await db.query.loanInvestors.findMany({
    where: inArray(loanInvestors.investorId, linkedInvestorIds),
    columns: { loanId: true },
  });
  const sharedLoanIds = [...new Set(sharedLinks.map((row) => row.loanId))];
  if (sharedLoanIds.length === 0) return ownedInvestors;

  const coInvestorRows = await db.query.loanInvestors.findMany({
    where: inArray(loanInvestors.loanId, sharedLoanIds),
    columns: { investorId: true },
  });
  const ownedIds = new Set(ownedInvestors.map((investor) => investor.id));
  const missingIds = [
    ...new Set(coInvestorRows.map((row) => row.investorId)),
  ].filter((id) => !ownedIds.has(id));
  if (missingIds.length === 0) return ownedInvestors;

  const sharedInvestors = await loadInvestorsByWhere(
    inArray(investors.id, missingIds),
    mode,
  );
  return [...ownedInvestors, ...sharedInvestors];
}

export async function getCachedBorrowers(
  userId: string,
  mode: "simple" | "list" | "full" = "full",
) {
  return remember(`borrowers:${userId}:${mode}`, () =>
    db.query.borrowers.findMany({
      where: or(
        eq(borrowers.userId, userId),
        eq(borrowers.borrowerUserId, userId),
      ),
      orderBy: (table, { asc }) => [asc(table.name)],
      with:
        mode === "simple"
          ? undefined
          : {
              loans: {
                columns: {
                  id: true,
                  loanName: true,
                  type: true,
                  status: true,
                  dueDate: true,
                },
              },
            },
    }),
  );
}

export async function getCachedWitnesses(
  userId: string,
  mode: "simple" | "list" | "full" = "full",
) {
  return remember(`witnesses:${userId}:${mode}`, () =>
    db.query.witnesses.findMany({
      where: or(
        eq(witnesses.userId, userId),
        eq(witnesses.witnessUserId, userId),
      ),
      orderBy: (table, { asc }) => [asc(table.name)],
      with:
        mode === "simple"
          ? undefined
          : {
              signingInvitations: {
                columns: {
                  id: true,
                  partyRole: true,
                  signedAt: true,
                },
                with: {
                  loan: {
                    columns: {
                      id: true,
                      loanName: true,
                      type: true,
                      status: true,
                      dueDate: true,
                    },
                  },
                },
              },
            },
    }),
  );
}

export async function getCachedDebts(
  userId: string,
  investorId: number | null,
) {
  return remember(`debts:${userId}:${investorId ?? "all"}`, async () => {
    const linkedInvestorIds = await loadLinkedInvestorContactIds(userId);

    return db.query.debts.findMany({
      where: investorId
        ? and(eq(debts.userId, userId), eq(debts.investorId, investorId))
        : linkedInvestorIds.length > 0
          ? or(
              eq(debts.userId, userId),
              inArray(debts.investorId, linkedInvestorIds),
            )
          : eq(debts.userId, userId),
      orderBy: (table, { desc }) => [desc(table.date)],
      with: { investor: true },
    });
  });
}

export async function getCachedTransactions(
  userId: string,
  investorId: number | null,
) {
  return remember(`transactions:${userId}:${investorId ?? "all"}`, async () => {
    const linkedInvestorIds = await loadLinkedInvestorContactIds(userId);

    return db.query.transactions.findMany({
      where: investorId
        ? and(
            eq(transactions.userId, userId),
            eq(transactions.investorId, investorId),
          )
        : linkedInvestorIds.length > 0
          ? or(
              eq(transactions.userId, userId),
              inArray(transactions.investorId, linkedInvestorIds),
            )
          : eq(transactions.userId, userId),
      orderBy: (table, { desc }) => [desc(table.date)],
      with: { investor: true },
    });
  });
}
