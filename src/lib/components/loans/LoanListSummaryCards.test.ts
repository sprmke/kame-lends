import { render } from "svelte/server";
import { describe, expect, it } from "vitest";
import LoanListSummaryCards from "./LoanListSummaryCards.svelte";
import type { LoanListSummaryStats } from "$lib/loan-list-summary";

const stats: LoanListSummaryStats = {
  currentCapital: 1000,
  totalCapitalInvested: 1000,
  interestEstimate: 200,
  interestEarned: 50,
  completedCount: 1,
  totalLoanCount: 4,
};

describe("LoanListSummaryCards", () => {
  it("shows the interest card by default", () => {
    const { body } = render(LoanListSummaryCards, { props: { stats } });
    expect(body).toContain("Interest");
    expect(body).toContain("About Principal");
    expect(body).toContain("About Interest");
    expect(body).toContain("lg:grid-cols-4");
  });

  it("drops the interest card and fills the row with three cards", () => {
    const { body } = render(LoanListSummaryCards, {
      props: { stats, showInterest: false },
    });
    expect(body).not.toContain("Interest");
    expect(body).not.toContain("About Interest");
    expect(body).toContain("About Principal");
    expect(body).toContain("Principal");
    expect(body).toContain("Total");
    expect(body).toContain("Completed");
    expect(body).toContain("grid-cols-2 lg:grid-cols-3");
    expect(body).toContain("col-span-2 lg:col-span-1");
  });
});
