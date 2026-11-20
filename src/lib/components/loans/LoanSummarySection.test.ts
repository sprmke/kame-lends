import { render } from "svelte/server";
import { describe, expect, it, vi } from "vitest";
import LoanSummarySection from "./LoanSummarySection.svelte";

describe("LoanSummarySection", () => {
  it("shows a Record payment action when the parent provides one", () => {
    const { body } = render(LoanSummarySection, {
      props: {
        totalPrincipal: 50000,
        averageRate: 10,
        totalInterest: 5000,
        totalAmount: 55000,
        totalReceived: 0,
        totalBalance: 55000,
        uniqueInvestors: 1,
        onRecordPayment: vi.fn(),
      },
    });
    expect(body).toContain("Record payment");
  });

  it("hides the action for read-only or scheduled loans", () => {
    const { body } = render(LoanSummarySection, {
      props: {
        totalPrincipal: 50000,
        averageRate: 10,
        totalInterest: 5000,
        totalAmount: 55000,
        totalReceived: 0,
        totalBalance: 55000,
        uniqueInvestors: 1,
      },
    });
    expect(body).not.toContain("Record payment");
  });
});
