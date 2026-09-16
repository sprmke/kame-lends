import {
  Home,
  FileText,
  Users,
  ContactRound,
  ArrowLeftRight,
  Settings,
  HandCoins,
  UserCheck,
  Folders,
} from "lucide-svelte";
import { SHOW_TRANSACTIONS_UI } from "$lib/feature-flags";

export interface NavCapabilities {
  /** User owns loan/CRM/debt rows (Settings maintenance, account Owner role). */
  isAdminWorkspace: boolean;
  hasInvestments: boolean;
  hasBorrowed: boolean;
  hasWitnessed: boolean;
  /** True when Groups is in the nav (layout sets this for any signed-in user when SHOW_GROUPS_UI is on). */
  hasGroups: boolean;
}

/** Lucide Svelte 5 icon constructors share one shape; `typeof Home` is the practical alias. */
export type AppNavIcon = typeof Home;

export interface AppNavItem {
  id: string;
  title: string;
  href: string;
  icon: AppNavIcon;
}

export interface AppNavGroup {
  id: string;
  /** Shown on desktop sidebar and phone More sheet when expanded. */
  label?: string;
  items: AppNavItem[];
}

/** Safe fallback when layout has not loaded capabilities yet (deny-by-default). */
export const DEFAULT_NAV_CAPABILITIES: NavCapabilities = {
  isAdminWorkspace: false,
  hasInvestments: false,
  hasBorrowed: false,
  hasWitnessed: false,
  hasGroups: false,
};

const DASHBOARD_ITEM: AppNavItem = {
  id: "dashboard",
  title: "Dashboard",
  href: "/dashboard",
  icon: Home,
};

const GROUPS_ITEM: AppNavItem = {
  id: "groups",
  title: "Groups",
  href: "/groups",
  icon: Folders,
};

/** Single loans hub; party views are tabs on `/loans?scope=…`. */
export const LOANS_ITEM: AppNavItem = {
  id: "loans",
  title: "Loans",
  href: "/loans",
  icon: FileText,
};

function settingsItem(): AppNavItem {
  return {
    id: "settings",
    title: "Settings",
    href: "/settings",
    icon: Settings,
  };
}

/** Workspace-owner bank / external loan tracker (`/debts`). */
const BANK_LOANS_ITEM: AppNavItem = {
  id: "debts",
  title: "Bank Loans",
  href: "/debts",
  icon: HandCoins,
};

/** CRM contact lists (`/investors`, `/borrowers`, `/witnesses`). */
function buildPeopleItems(): AppNavItem[] {
  const items: AppNavItem[] = [
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
  ];

  if (SHOW_TRANSACTIONS_UI) {
    items.push({
      id: "transactions",
      title: "Transactions",
      href: "/transactions",
      icon: ArrowLeftRight,
    });
  }

  return items;
}

export function flattenNavItems(groups: AppNavGroup[]): AppNavItem[] {
  return groups.flatMap((group) => group.items);
}

/** Same sidebar for every signed-in user; `hasGroups` only toggles Groups link. */
export function buildSidebarGroups(
  caps: NavCapabilities = DEFAULT_NAV_CAPABILITIES,
): AppNavGroup[] {
  const overviewItems: AppNavItem[] = [DASHBOARD_ITEM];
  if (caps.hasGroups) overviewItems.push(GROUPS_ITEM);
  overviewItems.push(LOANS_ITEM);

  const groups: AppNavGroup[] = [{ id: "overview", items: overviewItems }];

  groups.push({
    id: "people",
    label: "People",
    items: buildPeopleItems(),
  });
  groups.push({
    id: "bank-loans",
    label: "Tools",
    items: [BANK_LOANS_ITEM],
  });

  groups.push({ id: "settings", items: [settingsItem()] });
  return groups;
}

export function buildDestinationItems(
  caps: NavCapabilities = DEFAULT_NAV_CAPABILITIES,
): AppNavItem[] {
  const items: AppNavItem[] = [DASHBOARD_ITEM];

  if (caps.hasGroups) {
    items.push(GROUPS_ITEM);
  }

  items.push(LOANS_ITEM);
  items.push(...buildPeopleItems());
  items.push(BANK_LOANS_ITEM);

  return items;
}

/** Floating phone dock: hub routes only; People / Tools stay under More. */
export function buildMobilePrimaryTabs(
  caps: NavCapabilities = DEFAULT_NAV_CAPABILITIES,
): AppNavItem[] {
  const tabs: AppNavItem[] = [DASHBOARD_ITEM];
  if (caps.hasGroups) {
    tabs.push(GROUPS_ITEM);
  }
  tabs.push(LOANS_ITEM);
  tabs.push(settingsItem());
  return tabs;
}

export function buildAppNav(caps: NavCapabilities = DEFAULT_NAV_CAPABILITIES): {
  primaryTabs: AppNavItem[];
  moreNavItems: AppNavItem[];
  sidebarItems: AppNavItem[];
  sidebarGroups: AppNavGroup[];
} {
  const destinations = buildDestinationItems(caps);
  const sidebarGroups = buildSidebarGroups(caps);
  const sidebarItems = [...destinations, settingsItem()];
  const primaryTabs = buildMobilePrimaryTabs(caps);
  const moreNavItems = sidebarItems;

  return { primaryTabs, moreNavItems, sidebarItems, sidebarGroups };
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
  if (pathname.startsWith("/groups/new")) return "New group";
  if (pathname.startsWith("/groups/")) return "Group";
  if (pathname.startsWith("/groups")) return "Groups";
  if (pathname.startsWith("/loans/new")) return "New loan";
  if (pathname.startsWith("/loans/")) return "Loan";
  if (pathname.startsWith("/loans")) return "Loans";
  if (pathname.startsWith("/debts/new")) return "New bank loan";
  if (pathname.startsWith("/debts/")) return "Bank loan";
  if (pathname.startsWith("/debts")) return "Bank Loans";
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
  if (pathname.startsWith("/investments")) return "Loans";
  if (pathname.startsWith("/borrowed")) return "Loans";
  if (pathname.startsWith("/commissioned")) return "Loans";
  if (pathname.startsWith("/witnessed")) return "Loans";
  if (pathname.startsWith("/settings")) return "Settings";
  if (pathname.startsWith("/dashboard")) return "Dashboard";
  return "Kame Lends";
}

export function isDetailRoute(pathname: string): boolean {
  return (
    /^\/groups\/[^/]+/.test(pathname) ||
    /^\/loans\/[^/]+/.test(pathname) ||
    /^\/debts\/[^/]+/.test(pathname) ||
    /^\/investors\/[^/]+/.test(pathname) ||
    /^\/borrowers\/[^/]+/.test(pathname) ||
    /^\/witnesses\/[^/]+/.test(pathname) ||
    /^\/transactions\/[^/]+/.test(pathname) ||
    pathname.endsWith("/new")
  );
}
