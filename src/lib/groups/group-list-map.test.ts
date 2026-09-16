import { describe, expect, it } from "vitest";
import {
  buildWizardContactOptions,
  resolveWizardContactLoanIds,
} from "./group-list-map";
import type { WizardContactOption } from "$lib/components/groups/types";

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

describe("resolveWizardContactLoanIds", () => {
  const investorA: WizardContactOption = {
    partyType: "investor",
    contactId: 1,
    name: "Investor A",
    loanIds: [1, 2, 3],
  };
  const investorB: WizardContactOption = {
    partyType: "investor",
    contactId: 2,
    name: "Investor B",
    loanIds: [2, 4],
  };
  const borrowerX: WizardContactOption = {
    partyType: "borrower",
    contactId: 10,
    name: "Borrower X",
    loanIds: [2, 3],
  };

  it("unions loans within a single party type", () => {
    expect(resolveWizardContactLoanIds([investorA, investorB])).toEqual([
      1, 2, 3, 4,
    ]);
    expect(resolveWizardContactLoanIds([borrowerX])).toEqual([2, 3]);
  });

  it("intersects when both investors and borrowers are selected", () => {
    expect(resolveWizardContactLoanIds([investorA, borrowerX])).toEqual([2, 3]);
    expect(
      resolveWizardContactLoanIds([investorA, investorB, borrowerX]),
    ).toEqual([2, 3]);
  });

  it("returns empty when no contacts", () => {
    expect(resolveWizardContactLoanIds([])).toEqual([]);
  });
});
