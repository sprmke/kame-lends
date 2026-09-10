import { describe, expect, it } from "vitest";
import {
  DEFAULT_NAV_CAPABILITIES,
  buildDestinationItems,
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
