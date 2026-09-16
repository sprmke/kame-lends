import { and, eq, inArray, or } from "drizzle-orm";
import { db } from "$lib/server/db";
import { stripDataImageUrls } from "$lib/json-safe-images";
import { remember } from "$lib/server/memory-cache";
import {
  loadInvestmentLoanIds,
  loadLinkedInvestorContactIds,
} from "$lib/server/party-investor-links";
import {
  finalizeLoansForViewer,
  stripLegacyCommissionFields,
} from "$lib/server/loan-user-commission";
import type { LoanWithInvestors } from "$lib/types";
import {
  borrowers,
  debts,
  investors,
  loanGroupMembers,
  loanGroups,
  loanInvestors,
  loanSigningInvitations,
  loanWitnesses,
  loans,
  transactions,
  witnesses,
} from "$lib/server/db/schema";

export type LoanCacheMode = "full" | "list";
export type InvestorCacheMode = "simple" | "list" | "full";
export type LoanListScope =
  "owned" | "investments" | "borrowed" | "commissioned" | "witnessed" | "all";

const listRelations = {
  borrower: { columns: { borrowerUserId: true, email: true } },
  loanInvestors: {
    columns: {
      id: true,
      investorId: true,
      amount: true,
      interestRate: true,
      interestType: true,
      sentDate: true,
      isPaid: true,
      hasMultipleInterest: true,
      profitType: true,
      profitValue: true,
    },
    with: {
      investor: {
        columns: { id: true, name: true, investorUserId: true, email: true },
      },
      interestPeriods: {
        columns: { interestRate: true, interestType: true, dueDate: true },
      },
    },
  },
  signingInvitations: {
    columns: {
      id: true,
      witnessId: true,
      investorId: true,
      partyRole: true,
      partyEmail: true,
      signedAt: true,
      expiresAt: true,
    },
    with: {
      witness: { columns: { id: true, name: true, witnessUserId: true } },
    },
  },
  loanWitnesses: {
    columns: { id: true, witnessId: true, profitType: true, profitValue: true },
    with: {
      witness: { columns: { id: true, witnessUserId: true } },
    },
  },
  groupLoans: { columns: { groupId: true, source: true } },
} as const;

const partyContactColumns = {
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

const fullRelations = {
  borrower: { columns: { ...partyContactColumns, notes: true } },
  loanInvestors: {
    with: {
      investor: { columns: partyContactColumns },
      interestPeriods: true,
      receivedPayments: true,
    },
  },
  loanWitnesses: {
    with: {
      witness: { columns: partyContactColumns },
    },
  },
  groupLoans: { columns: { groupId: true, source: true } },
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

export async function getCachedLoansByIds(
  ids: number[],
  mode: LoanCacheMode = "list",
) {
  const sorted = [...new Set(ids)].sort((a, b) => a - b);
  if (sorted.length === 0) return [];
  return remember(`loans:by-ids:${mode}:${sorted.join(",")}`, () =>
    loadLoansByIds(sorted, mode),
  );
}

async function loadLoansByIds(ids: number[], mode: LoanCacheMode) {
  if (ids.length === 0) return [];
  const rows =
    mode === "list"
      ? await db.query.loans.findMany({
          where: inArray(loans.id, ids),
          with: listRelations,
        })
      : await db.query.loans.findMany({
          where: inArray(loans.id, ids),
          with: fullRelations,
        });
  return stripDataImageUrls(
    rows.map((row) => stripLegacyCommissionFields(row as LoanWithInvestors)),
  );
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

async function loadCommissionedLoanIds(userId: string) {
  const [invested, borrowed, witnessed] = await Promise.all([
    loadInvestmentLoanIds(userId),
    loadBorrowedLoanIds(userId),
    loadWitnessedLoanIds(userId),
  ]);
  return [...new Set([...invested, ...borrowed, ...witnessed])];
}

async function loadWitnessedLoanIds(userId: string) {
  const witnessRecords = await db.query.witnesses.findMany({
    where: eq(witnesses.witnessUserId, userId),
    columns: { id: true },
  });
  if (witnessRecords.length === 0) return [];
  const witnessIds = witnessRecords.map((w) => w.id);
  const [viaInvitations, viaLoanWitnesses] = await Promise.all([
    db
      .select({ loanId: loanSigningInvitations.loanId })
      .from(loanSigningInvitations)
      .where(inArray(loanSigningInvitations.witnessId, witnessIds)),
    db
      .select({ loanId: loanWitnesses.loanId })
      .from(loanWitnesses)
      .where(inArray(loanWitnesses.witnessId, witnessIds)),
  ]);
  return [
    ...new Set([...viaInvitations, ...viaLoanWitnesses].map((r) => r.loanId)),
  ];
}

async function loadLoans(
  userId: string,
  mode: LoanCacheMode,
  scope: LoanListScope,
) {
  if (scope === "owned") {
    const rows =
      mode === "list"
        ? await db.query.loans.findMany({
            where: eq(loans.userId, userId),
            with: listRelations,
            orderBy: (table, { desc }) => [desc(table.createdAt)],
          })
        : await db.query.loans.findMany({
            where: eq(loans.userId, userId),
            with: fullRelations,
            orderBy: (table, { desc }) => [desc(table.createdAt)],
          });
    return finalizeLoansForViewer(
      stripDataImageUrls(rows) as LoanWithInvestors[],
      userId,
    );
  }

  let ids: number[];
  if (scope === "investments") {
    ids = await loadInvestmentLoanIds(userId);
  } else if (scope === "borrowed") {
    ids = await loadBorrowedLoanIds(userId);
  } else if (scope === "commissioned") {
    ids = await loadCommissionedLoanIds(userId);
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
  const sorted = result.sort(
    (a, b) => b.createdAt.getTime() - a.createdAt.getTime(),
  );
  return finalizeLoansForViewer(sorted as LoanWithInvestors[], userId);
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
      columns: {
        id: true,
        name: true,
        email: true,
        contactNumber: true,
        address: true,
        createdAt: true,
        updatedAt: true,
        userId: true,
        investorUserId: true,
      },
      with: investorListRelations,
    });
  }
  return db.query.investors.findMany({
    where,
    with: investorFullRelations,
  });
}

async function loadInvestors(userId: string, mode: InvestorCacheMode) {
  const [ownedInvestors, linkedInvestorIds] = await Promise.all([
    loadInvestorsByWhere(eq(investors.userId, userId), mode),
    loadLinkedInvestorContactIds(userId),
  ]);
  if (linkedInvestorIds.length === 0) {
    return stripDataImageUrls(ownedInvestors);
  }

  const sharedLinks = await db.query.loanInvestors.findMany({
    where: inArray(loanInvestors.investorId, linkedInvestorIds),
    columns: { loanId: true },
  });
  const sharedLoanIds = [...new Set(sharedLinks.map((row) => row.loanId))];
  if (sharedLoanIds.length === 0) {
    return stripDataImageUrls(ownedInvestors);
  }

  const coInvestorRows = await db.query.loanInvestors.findMany({
    where: inArray(loanInvestors.loanId, sharedLoanIds),
    columns: { investorId: true },
  });
  const ownedIds = new Set(ownedInvestors.map((investor) => investor.id));
  const missingIds = [
    ...new Set(coInvestorRows.map((row) => row.investorId)),
  ].filter((id) => !ownedIds.has(id));
  if (missingIds.length === 0) {
    return stripDataImageUrls(ownedInvestors);
  }

  const sharedInvestors = await loadInvestorsByWhere(
    inArray(investors.id, missingIds),
    mode,
  );
  return stripDataImageUrls([...ownedInvestors, ...sharedInvestors]);
}

export async function getCachedBorrowers(
  userId: string,
  mode: "simple" | "list" | "full" = "full",
) {
  return remember(`borrowers:${userId}:${mode}`, async () => {
    const rows = await db.query.borrowers.findMany({
      where: or(
        eq(borrowers.userId, userId),
        eq(borrowers.borrowerUserId, userId),
      ),
      orderBy: (table, { asc }) => [asc(table.name)],
      columns:
        mode === "list"
          ? {
              id: true,
              name: true,
              email: true,
              contactNumber: true,
              address: true,
              notes: true,
              createdAt: true,
              updatedAt: true,
            }
          : undefined,
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
    });
    return stripDataImageUrls(rows);
  });
}

export async function getCachedWitnesses(
  userId: string,
  mode: "simple" | "list" | "full" = "full",
) {
  return remember(`witnesses:${userId}:${mode}`, async () => {
    const rows = await db.query.witnesses.findMany({
      where: or(
        eq(witnesses.userId, userId),
        eq(witnesses.witnessUserId, userId),
      ),
      orderBy: (table, { asc }) => [asc(table.name)],
      columns:
        mode === "list"
          ? {
              id: true,
              name: true,
              email: true,
              contactNumber: true,
              address: true,
              createdAt: true,
              updatedAt: true,
            }
          : undefined,
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
    });
    return stripDataImageUrls(rows);
  });
}

export async function getCachedDebts(
  userId: string,
  investorId: number | null,
) {
  return remember(`debts:${userId}:${investorId ?? "all"}`, async () => {
    const linkedInvestorIds = await loadLinkedInvestorContactIds(userId);

    return stripDataImageUrls(
      await db.query.debts.findMany({
        where: investorId
          ? and(eq(debts.userId, userId), eq(debts.investorId, investorId))
          : linkedInvestorIds.length > 0
            ? or(
                eq(debts.userId, userId),
                inArray(debts.investorId, linkedInvestorIds),
              )
            : eq(debts.userId, userId),
        orderBy: (table, { desc }) => [desc(table.date)],
        with: { investor: { columns: partyContactColumns } },
      }),
    );
  });
}

const groupRelations = {
  creator: { columns: { id: true, name: true, email: true } },
  groupLoans: {
    columns: { loanId: true, source: true },
    with: {
      loan: {
        columns: { id: true, dueDate: true, status: true },
        with: {
          loanInvestors: {
            columns: { amount: true, isPaid: true },
          },
        },
      },
    },
  },
  members: {
    columns: { userId: true, partyRoles: true },
    with: { user: { columns: { id: true, name: true } } },
  },
  calendar: { columns: { status: true, googleCalendarId: true } },
  telegram: { columns: { status: true, chatTitle: true } },
} as const;

export type GroupsIndexItem = {
  id: number;
  name: string;
  color: string;
  loanCount: number;
};

export async function getGroupsIndexForUser(
  userId: string,
): Promise<GroupsIndexItem[]> {
  return remember(`groups:index:${userId}`, async () => {
    const groups = await loadGroupsForUser(userId);
    return groups.map((g) => ({
      id: g.id,
      name: g.name,
      color: g.color ?? "orange",
      loanCount: g.groupLoans?.length ?? 0,
    }));
  });
}

export async function getCachedGroupsForUser(userId: string) {
  return remember(`groups:${userId}`, () => loadGroupsForUser(userId));
}

async function loadGroupsForUser(userId: string) {
  const memberships = await db.query.loanGroupMembers.findMany({
    where: eq(loanGroupMembers.userId, userId),
    columns: { groupId: true },
  });
  const memberGroupIds = memberships.map((m) => m.groupId);

  return db.query.loanGroups.findMany({
    where:
      memberGroupIds.length > 0
        ? or(
            eq(loanGroups.creatorUserId, userId),
            inArray(loanGroups.id, memberGroupIds),
          )
        : eq(loanGroups.creatorUserId, userId),
    with: groupRelations,
    orderBy: (table, { desc }) => [desc(table.createdAt)],
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
