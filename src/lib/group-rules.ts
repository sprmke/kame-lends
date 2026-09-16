export type GroupRulePartyType = "investor" | "borrower";

export type GroupRuleMatchInput = {
  borrowerId: number | null;
  investorIds: number[];
};

export type GroupRule = {
  id?: number;
  groupId: number;
  partyType: GroupRulePartyType;
  contactId: number;
};

/** Pure matcher: which rules apply to a loan's parties. */
export function matchGroupRulesForLoan(
  loan: GroupRuleMatchInput,
  rules: GroupRule[],
): GroupRule[] {
  const investorSet = new Set(loan.investorIds);
  return rules.filter((rule) => {
    if (rule.partyType === "borrower") {
      return loan.borrowerId != null && rule.contactId === loan.borrowerId;
    }
    return investorSet.has(rule.contactId);
  });
}

export function groupIdsFromMatchedRules(rules: GroupRule[]): number[] {
  return [...new Set(rules.map((r) => r.groupId))];
}
