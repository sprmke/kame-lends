import type { LoanAccessContext } from "$lib/loan-access";

export function canShowMyCommissionCard(
  access?: LoanAccessContext | null,
): boolean {
  if (!access || access.isGroupViewer) return false;
  return access.memberships.some(
    (role) => role === "borrower" || role === "investor" || role === "witness",
  );
}

export function scrollCommissionSectionIntoView(): void {
  requestAnimationFrame(() => {
    document
      .getElementById("loan-my-commission-section")
      ?.scrollIntoView({ behavior: "smooth", block: "start" });
  });
}
