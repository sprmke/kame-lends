import { describe, expect, it } from "vitest";
import {
  DEFAULT_NAV_CAPABILITIES,
  LOANS_ITEM,
  buildAppNav,
  buildDestinationItems,
  buildSidebarGroups,
  flattenNavItems,
  resolveMobileDockHighlight,
  resolveMobileDockPathname,
} from "$lib/nav/app-nav";

const STANDARD_SIDEBAR_GROUP_IDS = [
  "overview",
  "people",
  "bank-loans",
  "settings",
] as const;

describe("buildSidebarGroups", () => {
  it("shows the same groups for party-only and workspace-owner caps", () => {
    const party = buildSidebarGroups(DEFAULT_NAV_CAPABILITIES);
    const owner = buildSidebarGroups({
      ...DEFAULT_NAV_CAPABILITIES,
      isAdminWorkspace: true,
    });
    expect(party.map((group) => group.id)).toEqual([
      ...STANDARD_SIDEBAR_GROUP_IDS,
    ]);
    expect(owner.map((group) => group.id)).toEqual([
      ...STANDARD_SIDEBAR_GROUP_IDS,
    ]);
  });

  it("shows Loans and People for every signed-in user", () => {
    const groups = buildSidebarGroups(DEFAULT_NAV_CAPABILITIES);
    expect(groups[0]?.items.map((item) => item.id)).toEqual([
      "dashboard",
      "loans",
    ]);
    expect(groups[0]?.items.find((i) => i.id === "loans")).toEqual(LOANS_ITEM);
    expect(groups[1]?.label).toBe("People");
    expect(groups[1]?.items.map((item) => item.id)).toContain("investors");
    expect(groups[1]?.items.map((item) => item.id)).not.toContain("debts");
    expect(groups[2]?.label).toBe("Tools");
    expect(groups[2]?.items).toEqual([
      expect.objectContaining({ id: "debts", title: "Bank Loans" }),
    ]);
  });

  it("does not duplicate party routes in the sidebar", () => {
    const groups = buildSidebarGroups({
      ...DEFAULT_NAV_CAPABILITIES,
      hasInvestments: true,
      hasBorrowed: true,
    });
    const ids = flattenNavItems(groups).map((item) => item.id);
    expect(ids).not.toContain("investments");
    expect(ids).not.toContain("borrowed");
  });

  it("shows Groups in overview when hasGroups is true", () => {
    const groups = buildSidebarGroups({
      ...DEFAULT_NAV_CAPABILITIES,
      hasGroups: true,
    });
    expect(groups[0]?.items.map((item) => item.id)).toEqual([
      "dashboard",
      "groups",
      "loans",
    ]);
  });
});

describe("buildDestinationItems", () => {
  it("includes People and Bank Loans for any session", () => {
    const ids = buildDestinationItems(DEFAULT_NAV_CAPABILITIES).map(
      (item) => item.id,
    );
    expect(ids).toContain("loans");
    expect(ids).toContain("investors");
    expect(ids).toContain("debts");
  });
});

describe("buildAppNav", () => {
  it("lists full nav in the More sheet for party users", () => {
    const { moreNavItems } = buildAppNav(DEFAULT_NAV_CAPABILITIES);
    const ids = moreNavItems.map((item) => item.id);
    expect(ids).toContain("settings");
    expect(ids).toContain("loans");
    expect(ids).toContain("investors");
    expect(ids).toContain("debts");
  });

  it("uses Dashboard, Groups, Loans, Settings on the phone dock when groups are on", () => {
    const { primaryTabs } = buildAppNav({
      ...DEFAULT_NAV_CAPABILITIES,
      hasGroups: true,
    });
    expect(primaryTabs.map((item) => item.id)).toEqual([
      "dashboard",
      "groups",
      "loans",
      "settings",
    ]);
  });

  it("omits Groups on the phone dock when SHOW_GROUPS_UI is off", () => {
    const { primaryTabs } = buildAppNav(DEFAULT_NAV_CAPABILITIES);
    expect(primaryTabs.map((item) => item.id)).toEqual([
      "dashboard",
      "loans",
      "settings",
    ]);
  });
});

describe("resolveMobileDockPathname", () => {
  it("prefers in-flight navigation over the settled route", () => {
    expect(resolveMobileDockPathname("/dashboard", "/loans", null)).toBe(
      "/loans",
    );
  });

  it("prefers pending tap over the settled route when not navigating", () => {
    expect(resolveMobileDockPathname("/dashboard", null, "/settings")).toBe(
      "/settings",
    );
  });

  it("prefers in-flight navigation over a stale pending tap", () => {
    expect(resolveMobileDockPathname("/dashboard", "/loans", "/settings")).toBe(
      "/loans",
    );
  });

  it("falls back to the settled route", () => {
    expect(resolveMobileDockPathname("/loans", null, null)).toBe("/loans");
  });
});

describe("resolveMobileDockHighlight", () => {
  it("highlights Settings on the dock, not More", () => {
    const { primaryTabs, moreNavItems } = buildAppNav({
      ...DEFAULT_NAV_CAPABILITIES,
      hasGroups: true,
    });
    const { moreActive } = resolveMobileDockHighlight(
      "/settings",
      primaryTabs,
      moreNavItems,
      false,
    );
    expect(moreActive).toBe(false);
  });

  it("highlights More when route is only in the sheet", () => {
    const { primaryTabs, moreNavItems } = buildAppNav(DEFAULT_NAV_CAPABILITIES);
    const { moreActive } = resolveMobileDockHighlight(
      "/investors",
      primaryTabs,
      moreNavItems,
      false,
    );
    expect(moreActive).toBe(true);
  });
});
