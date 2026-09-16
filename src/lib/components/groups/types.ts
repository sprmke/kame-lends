import type { PartyRole } from "$lib/group-membership-diff";
import type { GroupColorKey } from "$lib/groups/group-colors";

export type GroupChipSelection = "all" | "ungrouped" | number;

export type GroupBadgeData = {
  id: number;
  name: string;
  color: string;
};

export type GroupChipData = GroupBadgeData & {
  loanCountOnPage: number;
};

export type GroupIntegrationStatus =
  | "provisioning"
  | "active"
  | "error"
  | "disconnected"
  | "connected"
  | "bot_removed"
  | "none";

export type GroupListCardData = {
  id: number;
  name: string;
  color: string;
  description?: string | null;
  loanCount: number;
  outstandingPrincipal: number | string;
  nextDueDate?: Date | string | null;
  overdueCount: number;
  peopleInitials: string[];
  calendarStatus?: GroupIntegrationStatus;
  telegramStatus?: GroupIntegrationStatus;
  viewerRoles?: PartyRole[];
  isViewerOwner?: boolean;
};

export type AccessPreviewData = {
  gained: AccessPreviewPerson[];
  lost: AccessPreviewPerson[];
  unchanged: number;
  distinctBorrowerCount?: number;
  mixedBorrowerCount?: number;
  loanCount?: number;
};

export type AccessPreviewPerson = {
  userId?: string;
  name: string;
  roles: PartyRole[];
  hasEmail: boolean;
};

export type GroupPickerItem = GroupBadgeData & {
  loanCount?: number;
};

export type GroupPersonRow = {
  userId: string;
  name: string;
  roles: PartyRole[];
  loanCount: number;
  loans: { id: number; name: string }[];
  email?: string | null;
  calendarAccess?: "shared" | "pending" | "no_email";
};

export type GroupRuleRow = {
  id: number;
  partyType: "investor" | "borrower";
  contactName: string;
};

export type WizardLoanRow = {
  id: number;
  loanName: string;
  borrowerName?: string | null;
  dueDate?: Date | string | null;
  principal?: string | number | null;
  status?: string;
  groupBadges?: GroupBadgeData[];
};

export type WizardContactOption = {
  partyType: "investor" | "borrower";
  contactId: number;
  name: string;
  loanIds: number[];
};

export type GroupGeneralDraft = {
  name: string;
  color: GroupColorKey;
  description: string;
};

/** Maps legacy list payloads until aggregated group cards ship in 4.4. */
export function legacyGroupToListCard(
  group: {
    id: number;
    name: string;
    color?: string | null;
    notes?: string | null;
    groupLoans?: unknown[];
    members?: { name?: string | null }[];
    creatorUserId?: string;
  },
  options?: {
    viewerUserId?: string;
    viewerRoles?: PartyRole[];
    isViewerOwner?: boolean;
  },
): GroupListCardData {
  const loanCount = group.groupLoans?.length ?? 0;
  const peopleInitials =
    group.members
      ?.map((member) => member.name?.trim())
      .filter((name): name is string => Boolean(name)) ?? [];
  return {
    id: group.id,
    name: group.name,
    color: group.color ?? "orange",
    description: group.notes,
    loanCount,
    outstandingPrincipal: 0,
    overdueCount: 0,
    peopleInitials,
    calendarStatus: "none",
    telegramStatus: "none",
    viewerRoles: options?.viewerRoles,
    isViewerOwner: options?.isViewerOwner,
  };
}
