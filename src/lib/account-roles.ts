import type { NavCapabilities } from "$lib/nav/app-nav";

export const ACCOUNT_ROLE_LABELS = [
  "Admin",
  "Investor",
  "Borrower",
  "Witness",
] as const;

export type AccountRoleLabel = (typeof ACCOUNT_ROLE_LABELS)[number];

const STORED_ROLE_LABELS: Record<string, AccountRoleLabel> = {
  admin: "Admin",
  investor: "Investor",
  borrower: "Borrower",
  witness: "Witness",
};

/** Labels for Settings. Admin from workspace ownership; party roles from loans and transactions. */
export function accountRolesFromCapabilities(
  caps: Pick<
    NavCapabilities,
    "isAdminWorkspace" | "hasInvestments" | "hasBorrowed" | "hasWitnessed"
  >,
  storedRole?: string | null,
): AccountRoleLabel[] {
  const roles: AccountRoleLabel[] = [];
  if (caps.isAdminWorkspace) roles.push("Admin");
  if (caps.hasInvestments) roles.push("Investor");
  if (caps.hasBorrowed) roles.push("Borrower");
  if (caps.hasWitnessed) roles.push("Witness");
  if (roles.length > 0) return roles;

  const fallback = storedRole ? STORED_ROLE_LABELS[storedRole] : undefined;
  return fallback ? [fallback] : [];
}

export function formatAccountRoles(roles: readonly AccountRoleLabel[]): string {
  return roles.join(", ");
}
