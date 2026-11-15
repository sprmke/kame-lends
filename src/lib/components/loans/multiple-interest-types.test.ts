import { describe, expect, it } from "vitest";
import {
  hasDuplicateInterestDueDates,
  hasPeriodValue,
  type InterestPeriodData,
} from "./multiple-interest-types";

function period(overrides: Partial<InterestPeriodData>): InterestPeriodData {
  return {
    id: "p1",
    dueDate: "2026-03-31",
    interestRate: "",
    interestAmount: "",
    interestType: "rate",
    ...overrides,
  };
}

describe("interest period helpers", () => {
  it("requires a positive rate for rate periods (DATA-03)", () => {
    expect(hasPeriodValue(period({ interestRate: "3" }))).toBe(true);
    expect(hasPeriodValue(period({ interestRate: "" }))).toBe(false);
    expect(hasPeriodValue(period({ interestRate: "0" }))).toBe(false);
    expect(hasPeriodValue(period({ interestRate: "abc" }))).toBe(false);
  });

  it("requires a positive amount for fixed periods", () => {
    expect(
      hasPeriodValue(period({ interestType: "fixed", interestAmount: "2500" })),
    ).toBe(true);
    expect(
      hasPeriodValue(period({ interestType: "fixed", interestAmount: "" })),
    ).toBe(false);
  });

  it("ignores the field that does not match the type", () => {
    expect(
      hasPeriodValue(
        period({
          interestType: "fixed",
          interestRate: "3",
          interestAmount: "",
        }),
      ),
    ).toBe(false);
  });

  it("detects duplicate due dates", () => {
    expect(
      hasDuplicateInterestDueDates([
        period({ dueDate: "2026-03-31" }),
        period({ dueDate: "2026-03-31" }),
      ]),
    ).toBe(true);
    expect(
      hasDuplicateInterestDueDates([
        period({ dueDate: "2026-03-31" }),
        period({ dueDate: "2026-06-30" }),
      ]),
    ).toBe(false);
  });
});
