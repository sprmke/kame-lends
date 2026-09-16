import { describe, expect, it } from "vitest";
import { matchGroupRulesForLoan } from "./group-rules";

describe("matchGroupRulesForLoan", () => {
  const rules = [
    { groupId: 1, partyType: "borrower" as const, contactId: 10 },
    { groupId: 2, partyType: "investor" as const, contactId: 20 },
    { groupId: 3, partyType: "investor" as const, contactId: 21 },
  ];

  it("matches borrower and investor rules", () => {
    const matched = matchGroupRulesForLoan(
      { borrowerId: 10, investorIds: [20] },
      rules,
    );
    expect(matched.map((r) => r.groupId).sort()).toEqual([1, 2]);
  });

  it("matches nothing when parties differ", () => {
    expect(
      matchGroupRulesForLoan({ borrowerId: 99, investorIds: [98] }, rules),
    ).toEqual([]);
  });

  it("handles null borrower", () => {
    const matched = matchGroupRulesForLoan(
      { borrowerId: null, investorIds: [21] },
      rules,
    );
    expect(matched.map((r) => r.groupId)).toEqual([3]);
  });
});
