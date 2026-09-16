import { describe, expect, it } from "vitest";
import { canShowMyCommissionCard } from "./commission-edit-slot";
import type { LoanAccessContext } from "./loan-access";

function access(
  partial: Partial<LoanAccessContext> & Pick<LoanAccessContext, "memberships">,
): LoanAccessContext {
  return {
    canAdminEdit: false,
    canView: true,
    isGroupViewer: false,
    linkedInvestorId: null,
    linkedLoanWitnessId: null,
    viaGroupIds: [],
    signingPartyRoles: [],
    editableInvestorIds: [],
    ...partial,
    memberships: partial.memberships,
  };
}

describe("canShowMyCommissionCard", () => {
  it("shows for borrower, investor, or witness parties", () => {
    expect(canShowMyCommissionCard(access({ memberships: ["borrower"] }))).toBe(
      true,
    );
    expect(canShowMyCommissionCard(access({ memberships: ["investor"] }))).toBe(
      true,
    );
    expect(canShowMyCommissionCard(access({ memberships: ["witness"] }))).toBe(
      true,
    );
  });

  it("hides for loan managers without a party role", () => {
    expect(
      canShowMyCommissionCard(
        access({ memberships: ["owner"], canAdminEdit: true }),
      ),
    ).toBe(false);
  });

  it("hides for group viewers", () => {
    expect(
      canShowMyCommissionCard(
        access({ memberships: ["borrower"], isGroupViewer: true }),
      ),
    ).toBe(false);
  });
});
