import { describe, expect, it } from "vitest";
import {
  addIsoDays,
  defaultLoanNamePattern,
  formatDatedLoanName,
  formatInterestInput,
  loanNameFromTemplate,
  parseLoanTemplateInput,
  resolveLoanNamePattern,
} from "./loan-templates";

describe("formatDatedLoanName", () => {
  it("uses the sent date and due date", () => {
    expect(formatDatedLoanName("Agent Loan", "2026-10-21", "2026-11-05")).toBe(
      "Agent Loan (Oct 21 - Nov 5)",
    );
  });

  it("uses one date when the sent date and due date match", () => {
    expect(formatDatedLoanName("Agent Loan", "2026-10-21", "2026-10-21")).toBe(
      "Agent Loan (Oct 21)",
    );
  });

  it("drops the second month when the range stays in one month", () => {
    expect(formatDatedLoanName("Agent Loan", "2026-10-12", "2026-10-20")).toBe(
      "Agent Loan (Oct 12 - 20)",
    );
  });

  it("spells September as Sept and adds the year when it changes", () => {
    expect(formatDatedLoanName("Agent Loan", "2026-09-16", "2026-10-30")).toBe(
      "Agent Loan (Sept 16 - Oct 30)",
    );
    expect(formatDatedLoanName("Agent Loan", "2026-12-20", "2027-01-05")).toBe(
      "Agent Loan (Dec 20 - Jan 5, 2027)",
    );
  });
});

describe("resolveLoanNamePattern", () => {
  it("fills sent and due tokens and keeps the agent loan shape", () => {
    expect(defaultLoanNamePattern("Agent")).toBe("Agent Loan ({sent} - {due})");
    expect(
      resolveLoanNamePattern(
        defaultLoanNamePattern("Agent"),
        "2026-10-21",
        "2026-11-04",
      ),
    ).toBe("Agent Loan (Oct 21 - Nov 4)");
  });

  it("collapses a same-month range and a same-day range", () => {
    const pattern = "Agent Loan ({sent} - {due})";
    expect(resolveLoanNamePattern(pattern, "2026-10-12", "2026-10-20")).toBe(
      "Agent Loan (Oct 12 - 20)",
    );
    expect(resolveLoanNamePattern(pattern, "2026-10-21", "2026-10-21")).toBe(
      "Agent Loan (Oct 21)",
    );
  });

  it("keeps a prefix-only date range template working", () => {
    expect(
      loanNameFromTemplate(
        "Agent Loan",
        "date_range",
        "2026-10-21",
        "2026-11-05",
      ),
    ).toBe("Agent Loan (Oct 21 - Nov 5)");
    expect(
      loanNameFromTemplate("Mexico", "static", "2026-10-21", "2026-11-05"),
    ).toBe("Mexico");
  });
});

describe("addIsoDays", () => {
  it("adds days across a month boundary", () => {
    expect(addIsoDays("2026-10-21", 15)).toBe("2026-11-05");
  });
});

describe("formatInterestInput", () => {
  it("drops trailing zeros", () => {
    expect(formatInterestInput("10.00")).toBe("10");
    expect(formatInterestInput("10.50")).toBe("10.5");
  });
});

describe("parseLoanTemplateInput", () => {
  it("accepts an agent preset", () => {
    const parsed = parseLoanTemplateInput({
      name: "Agent Romina",
      loanName: "Agent Loan ({sent} - {due})",
      nameMode: "static",
      type: "Agent",
      borrowerId: 4,
      groupIds: [2, 2, 9],
      interestType: "rate",
      interestValue: "10",
      termDays: 15,
    });
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.value.borrowerIds).toEqual([4]);
    expect(parsed.value.groupIds).toEqual([2, 9]);
    expect(parsed.value.interestValue).toBe("10.00");
    expect(parsed.value.termDays).toBe(15);
    expect(parsed.value.nameMode).toBe("date_range");
    expect(parsed.value.freeLotSqm).toBeNull();
  });

  it("rejects a missing name and a term that is too long", () => {
    expect(
      parseLoanTemplateInput({ loanName: "Agent Loan", type: "Agent" }).ok,
    ).toBe(false);
    const term = parseLoanTemplateInput({
      name: "Agent",
      loanName: "Agent Loan",
      type: "Agent",
      interestValue: "10",
      termDays: 800,
    });
    expect(term.ok).toBe(false);
  });

  it("keeps one rate per investor and the borrower list", () => {
    const parsed = parseLoanTemplateInput({
      name: "Agent Romina",
      loanName: "Agent Loan ({sent} - {due})",
      type: "Agent",
      borrowerIds: [4, 4, 8],
      investors: [
        { investorId: 3, interestValue: "12" },
        { investorId: 5, interestValue: "" },
      ],
      interestType: "rate",
      interestValue: "10",
    });
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.value.borrowerIds).toEqual([4, 8]);
    expect(parsed.value.borrowerId).toBe(4);
    expect(parsed.value.investors).toEqual([
      { investorId: 3, interestValue: "12.00" },
      { investorId: 5, interestValue: "10.00" },
    ]);
  });

  it("keeps free lot only for Lot Title", () => {
    const agent = parseLoanTemplateInput({
      name: "Agent",
      loanName: "Agent Loan",
      type: "Agent",
      interestValue: "10",
      freeLotSqm: 12,
    });
    expect(agent.ok).toBe(true);
    if (!agent.ok) return;
    expect(agent.value.freeLotSqm).toBeNull();

    const lot = parseLoanTemplateInput({
      name: "Lot",
      loanName: "Mexico",
      type: "Lot Title",
      interestValue: "10",
      freeLotSqm: 12,
    });
    expect(lot.ok).toBe(true);
    if (!lot.ok) return;
    expect(lot.value.freeLotSqm).toBe(12);
  });
});
