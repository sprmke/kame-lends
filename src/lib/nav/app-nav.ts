import {
  Home,
  FileText,
  Users,
  ContactRound,
  ArrowLeftRight,
  Settings,
  HandCoins,
  PiggyBank,
  Eye,
  UserCheck,
} from "lucide-svelte";
import { SHOW_TRANSACTIONS_UI } from "$lib/feature-flags";

export interface NavCapabilities {
  isAdminWorkspace: boolean;
  hasInvestments: boolean;
  hasBorrowed: boolean;
  hasWitnessed: boolean;
}

/** Lucide Svelte 5 icon constructors share one shape; `typeof Home` is the practical alias. */
export type AppNavIcon = typeof Home;

export interface AppNavItem {
  id: string;
  title: string;
  href: string;
  icon: AppNavIcon;
}

/** Safe fallback when layout has not loaded capabilities yet (deny-by-default). */
export const DEFAULT_NAV_CAPABILITIES: NavCapabilities = {
  isAdminWorkspace: false,
  hasInvestments: false,
  hasBorrowed: false,
  hasWitnessed: false,
};

export function buildDestinationItems(
  caps: NavCapabilities = DEFAULT_NAV_CAPABILITIES,
): AppNavItem[] {
  const items: AppNavItem[] = [
    { id: "dashboard", title: "Dashboard", href: "/dashboard", icon: Home },
  ];

  if (caps.isAdminWorkspace) {
    items.push({ id: "loans", title: "Loans", href: "/loans", icon: FileText });
  }

  items.push(
    {
      id: "investments",
      title: "Investments",
      href: "/investments",
      icon: PiggyBank,
    },
    {
      id: "borrowed",
      title: "Borrowed",
      href: "/borrowed",
      icon: HandCoins,
    },
    {
      id: "witnessed",
      title: "Witnessed",
      href: "/witnessed",
      icon: Eye,
    },
  );

  if (caps.isAdminWorkspace) {
    if (SHOW_TRANSACTIONS_UI) {
      items.push({
        id: "transactions",
        title: "Transactions",
        href: "/transactions",
        icon: ArrowLeftRight,
      });
    }

    items.push(
      {
        id: "debts",
        title: "Borrowings",
        href: "/debts",
        icon: HandCoins,
      },
      {
        id: "investors",
        title: "Investors",
        href: "/investors",
        icon: Users,
      },
      {
        id: "borrowers",
        title: "Borrowers",
        href: "/borrowers",
        icon: ContactRound,
      },
      {
        id: "witnesses",
        title: "Witnesses",
        href: "/witnesses",
        icon: UserCheck,
      },
    );
  }

  return items;
}

/** Phone dock shows up to four destination shortcuts plus More; the sheet lists every nav link. */
export const MOBILE_DOCK_MAX_PRIMARY_TABS = 4;

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

  const sidebarItems = [...destinations, settings];
  const primaryTabs = destinations.slice(0, MOBILE_DOCK_MAX_PRIMARY_TABS);
  const moreNavItems = sidebarItems;

  return { primaryTabs, moreNavItems, sidebarItems };
}

export function isNavActive(pathname: string, href: string): boolean {
  return pathname === href || (href !== "/" && pathname.startsWith(`${href}/`));
}

/** One dock highlight at a time: primary shortcut, or More when the sheet is open / route is sheet-only. */
export function resolveMobileDockHighlight(
  pathname: string,
  primaryTabs: AppNavItem[],
  moreNavItems: AppNavItem[],
  moreOpen: boolean,
): { moreActive: boolean } {
  const activePrimaryTab = primaryTabs.find((item) =>
    isNavActive(pathname, item.href),
  );
  const moreActive =
    moreOpen ||
    (!activePrimaryTab &&
      moreNavItems.some((item) => isNavActive(pathname, item.href)));

  return { moreActive };
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
  if (pathname.startsWith("/borrowers/new")) return "New borrower";
  if (pathname.startsWith("/borrowers/")) return "Borrower";
  if (pathname.startsWith("/borrowers")) return "Borrowers";
  if (pathname.startsWith("/witnesses/new")) return "New witness";
  if (pathname.startsWith("/witnesses/")) return "Witness";
  if (pathname.startsWith("/witnesses")) return "Witnesses";
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
    /^\/witnesses\/[^/]+/.test(pathname) ||
    /^\/transactions\/[^/]+/.test(pathname) ||
    pathname.endsWith("/new")
  );
}
