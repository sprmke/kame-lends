import {
  ArrowLeftRight,
  ContactRound,
  FileText,
  HandCoins,
  UserCheck,
  Users,
  type Icon,
} from "lucide-svelte";
import { SHOW_TRANSACTIONS_UI } from "$lib/feature-flags";
import type { NavCapabilities } from "$lib/nav/app-nav";

export interface DashboardQuickAction {
  id: string;
  label: string;
  href: string;
  icon: Icon;
}

export function buildDashboardQuickActions(
  caps: NavCapabilities,
): DashboardQuickAction[] {
  if (!caps.isAdminWorkspace) return [];

  const actions: DashboardQuickAction[] = [
    { id: "loan", label: "Loan", href: "/loans/new", icon: FileText },
    {
      id: "borrowing",
      label: "Borrowing",
      href: "/debts/new",
      icon: HandCoins,
    },
    { id: "investor", label: "Investor", href: "/investors/new", icon: Users },
    {
      id: "borrower",
      label: "Borrower",
      href: "/borrowers/new",
      icon: ContactRound,
    },
    {
      id: "witness",
      label: "Witness",
      href: "/witnesses/new",
      icon: UserCheck,
    },
  ];

  if (SHOW_TRANSACTIONS_UI) {
    actions.push({
      id: "transaction",
      label: "Transaction",
      href: "/transactions/new",
      icon: ArrowLeftRight,
    });
  }

  return actions;
}
