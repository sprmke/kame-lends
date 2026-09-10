import { describe, expect, it } from "vitest";
import {
  accountRolesFromCapabilities,
  formatAccountRoles,
} from "./account-roles";

const none = {
  isAdminWorkspace: false,
  hasInvestments: false,
  hasBorrowed: false,
  hasWitnessed: false,
};

describe("accountRolesFromCapabilities", () => {
  it("lists every assigned role in Admin, Investor, Borrower, Witness order", () => {
    expect(
      accountRolesFromCapabilities({
        isAdminWorkspace: true,
        hasInvestments: true,
        hasBorrowed: true,
        hasWitnessed: true,
      }),
    ).toEqual(["Admin", "Investor", "Borrower", "Witness"]);
  });

  it("omits roles the user is not assigned", () => {
    expect(
      accountRolesFromCapabilities({
        ...none,
        hasInvestments: true,
        hasBorrowed: true,
      }),
    ).toEqual(["Investor", "Borrower"]);
  });

  it("falls back to the stored user role when nothing is assigned", () => {
    expect(accountRolesFromCapabilities(none, "investor")).toEqual([
      "Investor",
    ]);
  });

  it("returns an empty list when nothing is assigned and no stored role exists", () => {
    expect(accountRolesFromCapabilities(none)).toEqual([]);
  });
});

describe("formatAccountRoles", () => {
  it("joins labels with a comma", () => {
    expect(formatAccountRoles(["Investor", "Borrower"])).toBe(
      "Investor, Borrower",
    );
  });
});
