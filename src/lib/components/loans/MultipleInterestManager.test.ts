import { render } from "svelte/server";
import { describe, expect, it } from "vitest";
import MultipleInterestManager from "./MultipleInterestManager.svelte";
import type { InterestPeriodData } from "./multiple-interest-types";

const periods: InterestPeriodData[] = [
  {
    id: "p1",
    dueDate: "2026-06-30",
    interestRate: "3",
    interestAmount: "3000.00",
    interestType: "rate",
    status: "Completed",
  },
  {
    id: "p2",
    dueDate: "2026-12-31",
    interestRate: "3",
    interestAmount: "3000.00",
    interestType: "rate",
    status: "Pending",
  },
];

function renderManager(
  overrides: Partial<{
    mode: "single" | "multiple";
    periods: InterestPeriodData[];
    defaultInterestType: "rate" | "fixed";
    defaultInterestRate: string;
  }> = {},
) {
  return render(MultipleInterestManager, {
    props: {
      sentDate: "2026-01-15",
      loanDueDate: "2026-12-31",
      amount: "100000",
      defaultInterestRate: overrides.defaultInterestRate ?? "3",
      defaultInterestType: overrides.defaultInterestType ?? "rate",
      periods: overrides.periods ?? periods,
      mode: overrides.mode ?? "multiple",
      isEditing: true,
      onPeriodsChange: () => {},
      onModeChange: () => {},
    },
  });
}

describe("MultipleInterestManager", () => {
  it("shows a paid period with its status and an unlock control", () => {
    const { body } = renderManager();
    expect(body).toContain("Completed");
    expect(body).toContain("Unlock");
  });

  it("uses the ledger for the totals", () => {
    const { body } = renderManager();
    // 100,000 at 3% twice = 6,000 interest.
    expect(body).toContain("6,000");
  });

  it("labels fixed interest as Fixed, not Rate", () => {
    const { body } = renderManager({
      mode: "single",
      defaultInterestType: "fixed",
      defaultInterestRate: "2500",
    });
    expect(body).toContain("Fixed");
    expect(body).toContain("2,500");
  });

  it("shows the single-interest summary in single mode", () => {
    const { body } = renderManager({ mode: "single" });
    expect(body).toContain("Interest");
    expect(body).toContain("3,000");
  });
});
