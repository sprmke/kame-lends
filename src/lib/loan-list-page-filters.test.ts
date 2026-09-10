import { describe, expect, it } from "vitest";
import { UNASSIGNED_PARTICIPANT_FILTER_VALUE } from "$lib/list-filters";
import {
  isLoanBorrowerUnassigned,
  isLoanWitnessUnassigned,
  matchesLoanParticipantFilters,
} from "$lib/loan-list-page-filters";
import type { LoanWithInvestors } from "$lib/types";

function loan(overrides: Partial<LoanWithInvestors> = {}): LoanWithInvestors {
  return {
    id: 1,
    loanName: "Test",
    type: "Agent",
    status: "Fully Funded",
    dueDate: new Date("2026-01-01"),
    loanInvestors: [],
    signingInvitations: [],
    ...overrides,
  } as LoanWithInvestors;
}

describe("loan participant unassigned filters", () => {
  it("detects loans without a borrower", () => {
    expect(isLoanBorrowerUnassigned(loan())).toBe(true);
    expect(
      isLoanBorrowerUnassigned(
        loan({ borrowerId: 10, borrower: { id: 10, name: "Ada" } as never }),
      ),
    ).toBe(false);
  });

  it("detects loans without linked witnesses", () => {
    expect(isLoanWitnessUnassigned(loan())).toBe(true);
    expect(
      isLoanWitnessUnassigned(
        loan({
          signingInvitations: [
            {
              partyRole: "witness_1",
              witnessId: 3,
              witness: { id: 3, name: "Precious" },
            } as never,
          ],
        }),
      ),
    ).toBe(false);
  });

  it("filters loans with unassigned borrower only", () => {
    const filters = {
      selectedInvestors: [],
      selectedBorrowers: [UNASSIGNED_PARTICIPANT_FILTER_VALUE],
      selectedWitnesses: [],
    };

    expect(matchesLoanParticipantFilters(loan(), filters)).toBe(true);
    expect(
      matchesLoanParticipantFilters(
        loan({ borrowerId: 2, borrower: { id: 2, name: "Ben" } as never }),
        filters,
      ),
    ).toBe(false);
  });

  it("filters loans with unassigned witness only", () => {
    const filters = {
      selectedInvestors: [],
      selectedBorrowers: [],
      selectedWitnesses: [UNASSIGNED_PARTICIPANT_FILTER_VALUE],
    };

    expect(matchesLoanParticipantFilters(loan(), filters)).toBe(true);
    expect(
      matchesLoanParticipantFilters(
        loan({
          signingInvitations: [
            {
              partyRole: "witness_1",
              witnessId: 4,
              witness: { id: 4, name: "Arianna" },
            } as never,
          ],
        }),
        filters,
      ),
    ).toBe(false);
  });

  it("matches assigned borrower ids with OR semantics", () => {
    const filters = {
      selectedInvestors: [],
      selectedBorrowers: ["2", "5"],
      selectedWitnesses: [],
    };

    expect(
      matchesLoanParticipantFilters(
        loan({ borrowerId: 2, borrower: { id: 2, name: "Ben" } as never }),
        filters,
      ),
    ).toBe(true);
    expect(
      matchesLoanParticipantFilters(
        loan({ borrowerId: 9, borrower: { id: 9, name: "Other" } as never }),
        filters,
      ),
    ).toBe(false);
  });

  it("matches unassigned together with assigned ids", () => {
    const filters = {
      selectedInvestors: [],
      selectedBorrowers: [UNASSIGNED_PARTICIPANT_FILTER_VALUE, "2"],
      selectedWitnesses: [],
    };

    expect(matchesLoanParticipantFilters(loan(), filters)).toBe(true);
    expect(
      matchesLoanParticipantFilters(
        loan({ borrowerId: 2, borrower: { id: 2, name: "Ben" } as never }),
        filters,
      ),
    ).toBe(true);
    expect(
      matchesLoanParticipantFilters(
        loan({ borrowerId: 9, borrower: { id: 9, name: "Other" } as never }),
        filters,
      ),
    ).toBe(false);
  });
});
