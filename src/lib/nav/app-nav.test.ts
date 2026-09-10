import { describe, expect, it } from "vitest";
import {
  DEFAULT_NAV_CAPABILITIES,
  buildAppNav,
  buildDestinationItems,
  resolveMobileDockHighlight,
} from "$lib/nav/app-nav";

describe("buildDestinationItems", () => {
  it("shows party views only for a normal user session", () => {
    const ids = buildDestinationItems(DEFAULT_NAV_CAPABILITIES).map(
      (item) => item.id,
    );
    expect(ids).toEqual(["dashboard", "investments", "borrowed", "witnessed"]);
  });

  it("adds workspace-admin CRM destinations for an admin workspace", () => {
    const ids = buildDestinationItems({
      isAdminWorkspace: true,
      hasInvestments: true,
      hasBorrowed: true,
      hasWitnessed: true,
    }).map((item) => item.id);
    expect(ids).toEqual([
      "dashboard",
      "loans",
      "investments",
      "borrowed",
      "witnessed",
      "debts",
      "investors",
      "borrowers",
      "witnesses",
    ]);
  });
});

describe("buildAppNav", () => {
  it("keeps up to four destinations on the dock and lists every link in More", () => {
    const nav = buildAppNav(DEFAULT_NAV_CAPABILITIES);
    expect(nav.primaryTabs.map((item) => item.id)).toEqual([
      "dashboard",
      "investments",
      "borrowed",
      "witnessed",
    ]);
    expect(nav.moreNavItems.map((item) => item.id)).toEqual([
      "dashboard",
      "investments",
      "borrowed",
      "witnessed",
      "settings",
    ]);
    expect(nav.sidebarItems).toEqual(nav.moreNavItems);
  });

  it("lists every workspace-admin link in the More sheet", () => {
    const nav = buildAppNav({
      isAdminWorkspace: true,
      hasInvestments: true,
      hasBorrowed: true,
      hasWitnessed: true,
    });
    expect(nav.primaryTabs.map((item) => item.id)).toEqual([
      "dashboard",
      "loans",
      "investments",
      "borrowed",
    ]);
    expect(nav.moreNavItems.map((item) => item.id)).toEqual([
      "dashboard",
      "loans",
      "investments",
      "borrowed",
      "witnessed",
      "debts",
      "investors",
      "borrowers",
      "witnesses",
      "settings",
    ]);
    expect(nav.sidebarItems).toEqual(nav.moreNavItems);
  });
});

describe("resolveMobileDockHighlight", () => {
  const nav = buildAppNav(DEFAULT_NAV_CAPABILITIES);

  it("highlights only the matching dock shortcut for primary routes", () => {
    expect(
      resolveMobileDockHighlight(
        "/investments",
        nav.primaryTabs,
        nav.moreNavItems,
        false,
      ),
    ).toEqual({ moreActive: false });
  });

  it("highlights More for sheet-only routes", () => {
    expect(
      resolveMobileDockHighlight(
        "/settings",
        nav.primaryTabs,
        nav.moreNavItems,
        false,
      ),
    ).toEqual({ moreActive: true });
  });

  it("highlights only More while the sheet is open on a dock route", () => {
    expect(
      resolveMobileDockHighlight(
        "/investments",
        nav.primaryTabs,
        nav.moreNavItems,
        true,
      ),
    ).toEqual({ moreActive: true });
  });
});
