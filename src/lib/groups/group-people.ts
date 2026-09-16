import type { PartyRole } from "$lib/group-membership-diff";
import type { GroupPersonRow } from "$lib/components/groups/types";
import {
  calculateTotalInterest,
  calculateTotalPrincipal,
} from "$lib/calculations";
import { isOverdueLoanForDashboard } from "$lib/loan-due-date";
import type {
  Investor,
  InvestorWithLoans,
  LoanWithInvestors,
} from "$lib/types";

type GroupMemberRow = {
  userId: string;
  partyRoles: string[] | null;
  user?: { id: string; name: string | null; email: string | null } | null;
};

type GroupHubLoanInvestor = {
  investorUserId?: string | null;
  id?: number;
};

type GroupHubLoan = {
  id: number;
  loanName: string;
  userId?: string;
  borrower?: { borrowerUserId?: string | null } | null;
  loanInvestors?: Array<{
    investor?: GroupHubLoanInvestor | null;
  }>;
  loanWitnesses?: Array<{
    witness?: { witnessUserId?: string | null } | null;
  }>;
};

const PLACEHOLDER_INVESTOR_ID = 0;

function asGraph(loan: unknown): GroupHubLoan {
  return loan as GroupHubLoan;
}

function investorUserIdOf(
  investor: GroupHubLoanInvestor | null | undefined,
): string | null {
  return investor?.investorUserId?.trim() || null;
}

function userOnLoan(userId: string, loan: unknown): boolean {
  const graph = asGraph(loan);
  if (graph.userId === userId) return true;
  if (graph.borrower?.borrowerUserId === userId) return true;
  for (const allocation of graph.loanInvestors ?? []) {
    if (investorUserIdOf(allocation.investor) === userId) return true;
  }
  for (const row of graph.loanWitnesses ?? []) {
    if (row.witness?.witnessUserId === userId) return true;
  }
  return false;
}

function matchesRole(userId: string, loan: unknown, role: PartyRole): boolean {
  const graph = asGraph(loan);
  switch (role) {
    case "owner":
      return graph.userId === userId;
    case "investor":
      return (graph.loanInvestors ?? []).some(
        (allocation) => investorUserIdOf(allocation.investor) === userId,
      );
    case "borrower":
      return graph.borrower?.borrowerUserId === userId;
    case "witness":
      return (graph.loanWitnesses ?? []).some(
        (row) => row.witness?.witnessUserId === userId,
      );
    default:
      return userOnLoan(userId, loan);
  }
}

export function loansForPersonRole<T>(
  userId: string,
  loans: T[],
  role: PartyRole,
): T[] {
  return loans.filter((loan) => matchesRole(userId, loan, role));
}

export function investorFromGroupLoans(
  userId: string,
  loans: unknown[],
): (Investor & { investorUserId?: string | null }) | null {
  for (const loan of loans) {
    const graph = asGraph(loan);
    for (const allocation of graph.loanInvestors ?? []) {
      const investor = allocation.investor;
      if (investor && investorUserIdOf(investor) === userId && investor.id) {
        return investor as Investor & { investorUserId?: string | null };
      }
    }
  }
  return null;
}

export function allocationsForInvestorUser(
  userId: string,
  loans: LoanWithInvestors[],
) {
  return loans.flatMap((loan) =>
    (loan.loanInvestors ?? [])
      .filter(
        (allocation) =>
          investorUserIdOf(allocation.investor as GroupHubLoanInvestor) ===
          userId,
      )
      .map((allocation) => ({ ...allocation, loan })),
  );
}

export type GroupPersonCompactStats = {
  amount: number;
  interest: number;
  overdueCount: number;
  loanCount: number;
  amountLabel: "Capital" | "Principal";
};

export function compactStatsForPersonRole(
  userId: string,
  loans: LoanWithInvestors[],
  role: PartyRole,
): GroupPersonCompactStats {
  const roleLoans = loansForPersonRole(userId, loans, role);
  const overdueCount = roleLoans.filter((loan) =>
    isOverdueLoanForDashboard(loan),
  ).length;
  const allocations =
    role === "investor"
      ? allocationsForInvestorUser(userId, roleLoans)
      : roleLoans.flatMap((loan) =>
          (loan.loanInvestors ?? []).map((allocation) => ({
            ...allocation,
            loan,
          })),
        );

  return {
    amount: calculateTotalPrincipal(allocations),
    interest: calculateTotalInterest(allocations),
    overdueCount,
    loanCount: roleLoans.length,
    amountLabel: role === "investor" ? "Capital" : "Principal",
  };
}

function placeholderInvestor(person: {
  name: string;
  email?: string | null;
}): Investor {
  return {
    id: PLACEHOLDER_INVESTOR_ID,
    name: person.name,
    email: person.email ?? "",
    contactNumber: null,
    address: null,
    validIdUrl: null,
    eSignatureUrl: null,
    createdAt: new Date(0),
    updatedAt: new Date(0),
  };
}

export function buildGroupPersonInvestorView(
  person: { userId: string; name: string; email?: string | null },
  roleLoans: LoanWithInvestors[],
  role: PartyRole,
): { investor: InvestorWithLoans; scopeToInvestor: boolean } {
  const found =
    role === "investor"
      ? investorFromGroupLoans(person.userId, roleLoans)
      : null;
  const base = found ?? placeholderInvestor(person);
  return {
    investor: {
      ...base,
      loanInvestors: [],
      transactions: [],
      debts: [],
    },
    scopeToInvestor: Boolean(found),
  };
}

export function buildGroupPeopleRows(
  members: GroupMemberRow[],
  loans: unknown[],
  creatorUserId: string,
  options: { includeEmail?: boolean } = {},
): GroupPersonRow[] {
  const includeEmail = options.includeEmail ?? false;
  return members.map((member) => {
    const roleSet = new Set((member.partyRoles ?? []) as PartyRole[]);
    if (member.userId === creatorUserId) {
      roleSet.add("owner");
    }
    const roles = [...roleSet].sort() as PartyRole[];
    const memberLoans = loans
      .map(asGraph)
      .filter((loan) => userOnLoan(member.userId, loan));
    const email = includeEmail ? member.user?.email?.trim() || null : null;
    const hasEmail = Boolean(member.user?.email?.trim());

    return {
      userId: member.userId,
      name: member.user?.name?.trim() || "Unknown",
      roles,
      loanCount: memberLoans.length,
      loans: memberLoans.map((loan) => ({ id: loan.id, name: loan.loanName })),
      email,
      calendarAccess: hasEmail ? "pending" : "no_email",
    };
  });
}
