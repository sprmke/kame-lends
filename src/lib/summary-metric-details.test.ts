import { describe, expect, it } from "vitest";
import {
  borrowerMetricDetails,
  commissionMetricDetails,
  dashboardMetricDetails,
  investorOverviewDetails,
  loanListMetricDetails,
} from "./summary-metric-details";

function assertPlain(text: string) {
  expect(text).not.toContain("—");
  expect(text).not.toMatch(/still out|first amount|the second|at once/i);
}

describe("summary metric details", () => {
  it("explains the slash on loan list cards in everyday words", () => {
    const details = loanListMetricDetails();
    expect(details.principal).toContain("already sent");
    expect(details.principal).toContain("Not paid back yet");
    expect(details.principal).toContain("date range");
    expect(details.interest).toContain("Earned / estimated");
    expect(details.completed).toContain("Completed loans / all");
    for (const text of Object.values(details)) assertPlain(text);
  });

  it("names the group, the selection, and whose money", () => {
    expect(loanListMetricDetails("group").principal).toContain("in this group");
    expect(loanListMetricDetails("selection").completed).toContain(
      "you selected",
    );
    expect(loanListMetricDetails("selection", "share").principal).toContain(
      "this person already sent",
    );
    expect(loanListMetricDetails("range", "share").interest).toContain(
      "this person's loans",
    );
  });

  it("explains commission without sounding like a formula", () => {
    const details = commissionMetricDetails("selection");
    expect(details.principal).toContain("same time");
    expect(details.principal).toContain("you selected");
    expect(details.estimate).toContain("not collected yet");
    expect(details.earned).toContain("completed loans");
    expect(details.completed).toContain("Completed loans / all");
    for (const text of Object.values(details)) assertPlain(text);
  });

  it("keeps dashboard, investor, and borrower notes in the same voice", () => {
    for (const text of [
      ...Object.values(dashboardMetricDetails),
      ...Object.values(investorOverviewDetails),
      ...Object.values(borrowerMetricDetails),
    ]) {
      assertPlain(text);
    }
    expect(dashboardMetricDetails.totalPrincipal).toContain("not added twice");
    expect(investorOverviewDetails.totalCapital).toContain("this person's");
    expect(borrowerMetricDetails.totalDue).toContain("plus interest");
  });
});
