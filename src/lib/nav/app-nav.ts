import type { Component } from "svelte";
import {
  Home,
  FileText,
  Users,
  ArrowLeftRight,
  Settings,
  HandCoins,
  PiggyBank,
  Eye,
} from "lucide-svelte";
import { SHOW_TRANSACTIONS_UI } from "$lib/feature-flags";

export interface NavCapabilities {
  isAdminWorkspace: boolean;
  hasInvestments: boolean;
  hasBorrowed: boolean;
  hasWitnessed: boolean;
}

export interface AppNavItem {
  id: string;
  title: string;
  href: string;
  icon: Component;
}

/** Safe fallback when layout has not loaded capabilities yet (deny-by-default). */
export const DEFAULT_NAV_CAPABILITIES: NavCapabilities = {
  isAdminWorkspace: false,
  hasInvestments: false,
  hasBorrowed: false,
  hasWitnessed: false,
};

const MAX_PRIMARY_TABS = 4;

export function buildDestinationItems(
  caps: NavCapabilities = DEFAULT_NAV_CAPABILITIES,
): AppNavItem[] {
  const items: AppNavItem[] = [
    { id: "dashboard", title: "Dashboard", href: "/dashboard", icon: Home },
  ];

  if (caps.isAdminWorkspace) {
    items.push({ id: "loans", title: "Loans", href: "/loans", icon: FileText });
  }
  if (caps.hasInvestments) {
    items.push({
      id: "investments",
      title: "Investments",
      href: "/investments",
      icon: PiggyBank,
    });
  }
  if (caps.hasBorrowed) {
    items.push({
      id: "borrowed",
      title: "Borrowed",
      href: "/borrowed",
      icon: HandCoins,
    });
  }
  if (caps.hasWitnessed) {
    items.push({
      id: "witnessed",
      title: "Witnessed",
      href: "/witnessed",
      icon: Eye,
    });
  }
  if (caps.isAdminWorkspace && SHOW_TRANSACTIONS_UI) {
    items.push({
      id: "transactions",
      title: "Transactions",
      href: "/transactions",
      icon: ArrowLeftRight,
    });
  }
  if (caps.isAdminWorkspace) {
    items.push({
      id: "debts",
      title: "Borrowings",
      href: "/debts",
      icon: HandCoins,
    });
    items.push({
      id: "investors",
      title: "Investors",
      href: "/investors",
      icon: Users,
    });
  }

  return items;
}

export function buildAppNav(caps: NavCapabilities = DEFAULT_NAV_CAPABILITIES): {
  primaryTabs: AppNavItem[];
  moreNavItems: AppNavItem[];
  sidebarItems: AppNavItem[];
} {
  const destinations = buildDestinationItems(caps);
  const settings: AppNavItem = {
    id: "settings",
    title: "Settings",
    href: "/settings",
    icon: Settings,
  };

  const primaryTabs = destinations.slice(0, MAX_PRIMARY_TABS);
  const overflow = destinations.slice(MAX_PRIMARY_TABS);
  const moreNavItems = [...overflow, settings];
  const sidebarItems = [...destinations, settings];

  return { primaryTabs, moreNavItems, sidebarItems };
}

export function isNavActive(pathname: string, href: string): boolean {
  return pathname === href || (href !== "/" && pathname.startsWith(`${href}/`));
}

export function resolveMobilePageTitle(pathname: string): string {
  if (pathname.startsWith("/loans/new")) return "New loan";
  if (pathname.startsWith("/loans/")) return "Loan";
  if (pathname.startsWith("/loans")) return "Loans";
  if (pathname.startsWith("/debts/new")) return "New borrowing";
  if (pathname.startsWith("/debts/")) return "Borrowing";
  if (pathname.startsWith("/debts")) return "Borrowings";
  if (pathname.startsWith("/investors/new")) return "New investor";
  if (pathname.startsWith("/investors/")) return "Investor";
  if (pathname.startsWith("/investors")) return "Investors";
  if (pathname.startsWith("/borrowers/")) return "Borrower";
  if (pathname.startsWith("/transactions/new")) return "New transaction";
  if (pathname.startsWith("/transactions/")) return "Transaction";
  if (pathname.startsWith("/transactions")) return "Transactions";
  if (pathname.startsWith("/investments")) return "Investments";
  if (pathname.startsWith("/borrowed")) return "Borrowed";
  if (pathname.startsWith("/witnessed")) return "Witnessed";
  if (pathname.startsWith("/settings")) return "Settings";
  if (pathname.startsWith("/dashboard")) return "Dashboard";
  return "Kame Lends";
}

export function isDetailRoute(pathname: string): boolean {
  return (
    /^\/loans\/[^/]+/.test(pathname) ||
    /^\/debts\/[^/]+/.test(pathname) ||
    /^\/investors\/[^/]+/.test(pathname) ||
    /^\/borrowers\/[^/]+/.test(pathname) ||
    /^\/transactions\/[^/]+/.test(pathname) ||
    pathname.endsWith("/new")
  );
}
