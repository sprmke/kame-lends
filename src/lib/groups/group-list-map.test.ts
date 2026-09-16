import { describe, expect, it } from "vitest";
import { buildWizardContactOptions } from "./group-list-map";

describe("buildWizardContactOptions", () => {
  it("collects investor and borrower contacts with loan ids", () => {
    const options = buildWizardContactOptions([
      {
        id: 1,
        loanName: "A",
        status: "Active",
        dueDate: "2026-01-01",
        borrowerId: 10,
        borrower: { id: 10, name: "Borrower A" },
        loanInvestors: [
          {
            amount: "1000",
            investorId: 20,
            investor: { id: 20, name: "Investor A" },
          },
        ],
      },
      {
        id: 2,
        loanName: "B",
        status: "Active",
        dueDate: "2026-02-01",
        borrowerId: 10,
        borrower: { id: 10, name: "Borrower A" },
        loanInvestors: [
          {
            amount: "500",
            investorId: 20,
            investor: { id: 20, name: "Investor A" },
          },
        ],
      },
    ]);

    expect(options).toEqual(
      expect.arrayContaining([
        {
          partyType: "borrower",
          contactId: 10,
          name: "Borrower A",
          loanIds: [1, 2],
        },
        {
          partyType: "investor",
          contactId: 20,
          name: "Investor A",
          loanIds: [1, 2],
        },
      ]),
    );
  });
});
