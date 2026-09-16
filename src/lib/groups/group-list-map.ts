import type { PartyRole } from "$lib/group-membership-diff";
import type {
  GroupBadgeData,
  GroupIntegrationStatus,
  GroupListCardData,
  WizardContactOption,
  WizardLoanRow,
} from "$lib/components/groups/types";
import { calculateTotalPrincipal, isOpenLoan } from "$lib/calculations";
import { isOverdueLoanForDashboard } from "$lib/loan-due-date";

export type CachedGroupRecord = {
  id: number;
  name: string;
  color?: string | null;
  notes?: string | null;
  creatorUserId: string;
  createdAt: Date;
  updatedAt: Date;
  groupLoans?: Array<{
    loanId: number;
    loan?: {
      id: number;
      dueDate: Date | string;
      status: string;
      loanInvestors?: Array<{ amount: string; isPaid?: boolean | null }>;
    } | null;
  }>;
  members?: Array<{
    userId: string;
    partyRoles: string[] | null;
    user?: { name: string | null } | null;
  }>;
  calendar?: { status: string } | null;
  telegram?: { status: string } | null;
};

export type GroupListCardWithMeta = GroupListCardData & {
  updatedAt: string;
};

function asIntegrationStatus(
  value: string | undefined,
  kind: "calendar" | "telegram",
): GroupIntegrationStatus {
  if (!value) return "none";
  if (kind === "calendar") {
    if (value === "provisioning" || value === "active" || value === "error") {
      return value;
    }
    return "none";
  }
  if (
    value === "disconnected" ||
    value === "connected" ||
    value === "bot_removed"
  ) {
    return value;
  }
  return "none";
}

export function mapGroupToListCard(
  group: CachedGroupRecord,
  viewerUserId: string,
): GroupListCardWithMeta {
  const member = group.members?.find((row) => row.userId === viewerUserId);
  const viewerRoles = (member?.partyRoles ?? []) as PartyRole[];
  const peopleInitials =
    group.members
      ?.map((row) => row.user?.name?.trim())
      .filter((name): name is string => Boolean(name)) ?? [];

  const loans = (group.groupLoans ?? [])
    .map((link) => link.loan)
    .filter((loan): loan is NonNullable<typeof loan> => Boolean(loan));

  let outstandingPrincipal = 0;
  let overdueCount = 0;
  let nextDueDate: Date | string | null = null;

  for (const loan of loans) {
    const paid = (loan.loanInvestors ?? []).filter((row) => row.isPaid);
    if (paid.length > 0 && isOpenLoan(loan)) {
      outstandingPrincipal += calculateTotalPrincipal(paid as never);
    }
    if (isOverdueLoanForDashboard(loan as never)) {
      overdueCount += 1;
    }
    if (isOpenLoan(loan)) {
      if (
        !nextDueDate ||
        String(loan.dueDate).localeCompare(String(nextDueDate)) < 0
      ) {
        nextDueDate = loan.dueDate;
      }
    }
  }

  return {
    id: group.id,
    name: group.name,
    color: group.color ?? "orange",
    description: group.notes,
    loanCount: group.groupLoans?.length ?? 0,
    outstandingPrincipal,
    overdueCount,
    nextDueDate,
    peopleInitials,
    calendarStatus: asIntegrationStatus(group.calendar?.status, "calendar"),
    telegramStatus: asIntegrationStatus(group.telegram?.status, "telegram"),
    viewerRoles,
    isViewerOwner: group.creatorUserId === viewerUserId,
    updatedAt: group.updatedAt.toISOString(),
  };
}

type OwnedLoanForWizard = {
  id: number;
  loanName: string;
  status: string;
  dueDate: Date | string;
  borrowerId?: number | null;
  borrower?: {
    id?: number;
    name?: string | null;
    borrowerUserId?: string | null;
    email?: string | null;
  } | null;
  loanInvestors?: Array<{
    amount: string;
    isPaid?: boolean | null;
    investorId?: number;
    investor?: { id: number; name: string } | null;
  }>;
  groupLoans?: Array<{ groupId: number }>;
};

export function mapOwnedLoanToWizardRow(
  loan: OwnedLoanForWizard,
  groupMeta: Map<number, GroupBadgeData>,
): WizardLoanRow {
  const paid = (loan.loanInvestors ?? []).filter((row) => row.isPaid);
  const principal =
    paid.length > 0 ? calculateTotalPrincipal(paid as never) : null;
  const groupBadges = (loan.groupLoans ?? [])
    .map((link) => groupMeta.get(link.groupId))
    .filter((badge): badge is GroupBadgeData => Boolean(badge));

  return {
    id: loan.id,
    loanName: loan.loanName,
    borrowerName: loan.borrower?.name,
    dueDate: loan.dueDate,
    principal,
    status: loan.status,
    groupBadges,
  };
}

export function buildWizardContactOptions(
  loans: OwnedLoanForWizard[],
): import("$lib/components/groups/types").WizardContactOption[] {
  const byInvestor = new Map<number, { name: string; loanIds: number[] }>();
  const byBorrower = new Map<number, { name: string; loanIds: number[] }>();

  for (const loan of loans) {
    const borrowerId = loan.borrowerId ?? loan.borrower?.id ?? null;
    const borrowerName = loan.borrower?.name?.trim();
    if (borrowerId != null && borrowerName) {
      const entry = byBorrower.get(borrowerId) ?? {
        name: borrowerName,
        loanIds: [],
      };
      if (!entry.loanIds.includes(loan.id)) entry.loanIds.push(loan.id);
      byBorrower.set(borrowerId, entry);
    }

    for (const link of loan.loanInvestors ?? []) {
      const investorId = link.investorId ?? link.investor?.id;
      const investorName = link.investor?.name?.trim();
      if (investorId == null || !investorName) continue;
      const entry = byInvestor.get(investorId) ?? {
        name: investorName,
        loanIds: [],
      };
      if (!entry.loanIds.includes(loan.id)) entry.loanIds.push(loan.id);
      byInvestor.set(investorId, entry);
    }
  }

  const out: import("$lib/components/groups/types").WizardContactOption[] = [];
  for (const [contactId, entry] of byBorrower) {
    out.push({
      partyType: "borrower",
      contactId,
      name: entry.name,
      loanIds: entry.loanIds,
    });
  }
  for (const [contactId, entry] of byInvestor) {
    out.push({
      partyType: "investor",
      contactId,
      name: entry.name,
      loanIds: entry.loanIds,
    });
  }
  out.sort((a, b) => a.name.localeCompare(b.name));
  return out;
}

function unionContactLoanIds(contacts: WizardContactOption[]): Set<number> {
  const ids = new Set<number>();
  for (const contact of contacts) {
    for (const id of contact.loanIds) ids.add(id);
  }
  return ids;
}

/** Loans to preselect / filter in the create-group wizard for the current contact picks. */
export function resolveWizardContactLoanIds(
  contacts: WizardContactOption[],
): number[] {
  const investors = contacts.filter((c) => c.partyType === "investor");
  const borrowers = contacts.filter((c) => c.partyType === "borrower");

  if (investors.length > 0 && borrowers.length > 0) {
    const investorIds = unionContactLoanIds(investors);
    const borrowerIds = unionContactLoanIds(borrowers);
    return [...investorIds].filter((id) => borrowerIds.has(id));
  }
  if (investors.length > 0) return [...unionContactLoanIds(investors)];
  if (borrowers.length > 0) return [...unionContactLoanIds(borrowers)];
  return [];
}
