import { describe, expect, it } from "vitest";
import { createDuplicateDataFromLoan } from "./loan-duplicate";
import type { LoanWithInvestors } from "./types";

describe("createDuplicateDataFromLoan", () => {
  it("keeps contract customization and group membership", () => {
    const loan = {
      id: 1,
      userId: "u1",
      borrowerId: null,
      loanName: "Duplicate me",
      type: "Agent",
      status: "Fully Funded",
      dueDate: new Date("2027-01-31"),
      freeLotSqm: null,
      notes: null,
      profitType: "rate",
      profitValue: "0",
      createdAt: new Date(),
      updatedAt: new Date(),
      loanContract: {
        customization: {
          contractTitle: "Custom title",
          borrowerDateSigned: "2026-01-01",
        },
      },
      loanInvestors: [],
      loanWitnesses: [],
      signingInvitations: [],
      groupLoans: [{ groupId: 4 }, { groupId: 7 }],
    } as unknown as LoanWithInvestors;

    const duplicate = createDuplicateDataFromLoan(loan);
    expect(duplicate.groupIds).toEqual([4, 7]);
    expect(duplicate.contractCustomization?.contractTitle).toBe("Custom title");
    expect(duplicate.contractCustomization?.borrowerDateSigned).toBe("");
  });
});
