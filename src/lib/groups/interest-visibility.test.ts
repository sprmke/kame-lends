import { describe, expect, it } from "vitest";
import { viewerCanSeeGroupInterest } from "./interest-visibility";

const hidden = {
  showInterestToOwners: false,
  showInterestToInvestors: false,
  showInterestToBorrowers: false,
  showInterestToWitnesses: false,
};

const shown = {
  showInterestToOwners: true,
  showInterestToInvestors: true,
  showInterestToBorrowers: true,
  showInterestToWitnesses: true,
};

describe("viewerCanSeeGroupInterest", () => {
  it("always shows interest to the group creator", () => {
    expect(
      viewerCanSeeGroupInterest({
        isCreator: true,
        roles: ["investor", "borrower"],
        visibility: hidden,
      }),
    ).toBe(true);
  });

  it("shows interest to every role when those checkboxes are on", () => {
    for (const role of ["owner", "investor", "borrower", "witness"]) {
      expect(
        viewerCanSeeGroupInterest({
          isCreator: false,
          roles: [role],
          visibility: shown,
        }),
      ).toBe(true);
    }
  });

  it("hides interest from a role when that checkbox is off", () => {
    expect(
      viewerCanSeeGroupInterest({
        isCreator: false,
        roles: ["owner"],
        visibility: { ...shown, showInterestToOwners: false },
      }),
    ).toBe(false);
    expect(
      viewerCanSeeGroupInterest({
        isCreator: false,
        roles: ["investor"],
        visibility: hidden,
      }),
    ).toBe(false);
    expect(
      viewerCanSeeGroupInterest({
        isCreator: false,
        roles: ["witness"],
        visibility: { ...hidden, showInterestToWitnesses: true },
      }),
    ).toBe(true);
  });

  it("hides interest when any held role is off", () => {
    expect(
      viewerCanSeeGroupInterest({
        isCreator: false,
        roles: ["investor", "borrower"],
        visibility: { ...shown, showInterestToBorrowers: false },
      }),
    ).toBe(false);
  });
});
