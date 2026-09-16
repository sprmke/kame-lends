import { describe, expect, it } from "vitest";
import { computeLoanAccessContext } from "$lib/loan-access-compute";

const graph = {
  id: 1,
  userId: "owner-1",
  borrower: { borrowerUserId: "borrower-1", email: "b@example.com" },
  loanInvestors: [
    {
      investorId: 9,
      investor: { investorUserId: "investor-1", email: "i@example.com" },
    },
  ],
  signingInvitations: [],
  loanWitnesses: [
    {
      id: 4,
      witness: { witnessUserId: "witness-1", email: "w@example.com" },
    },
  ],
};

describe("computeLoanAccessContext", () => {
  it("grants owner admin edit", () => {
    const access = computeLoanAccessContext(graph, "owner-1", "o@example.com");
    expect(access.canView).toBe(true);
    expect(access.canAdminEdit).toBe(true);
    expect(access.memberships).toContain("owner");
  });

  it("links investor and witness without a second query", () => {
    const investor = computeLoanAccessContext(
      graph,
      "investor-1",
      "i@example.com",
    );
    expect(investor.canAdminEdit).toBe(false);
    expect(investor.linkedInvestorId).toBe(9);
    const witness = computeLoanAccessContext(
      graph,
      "witness-1",
      "w@example.com",
    );
    expect(witness.memberships).toContain("witness");
    expect(witness.linkedLoanWitnessId).toBe(4);
  });

  it("does not grant view from blank invitation emails", () => {
    const openSlots = {
      ...graph,
      loanWitnesses: [],
      signingInvitations: [
        {
          partyRole: "witness_1",
          partyEmail: null,
          investorId: null,
          witness: null,
        },
      ],
    };
    const access = computeLoanAccessContext(
      openSlots,
      "stranger-1",
      "stranger@example.com",
    );
    expect(access.canView).toBe(false);
    expect(access.memberships).toEqual([]);
  });
});
