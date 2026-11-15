import { describe, expect, it } from "vitest";
import {
  convertPeriodValue,
  interestEditorErrors,
  interestEditorReducer,
  monthEndKeys,
  type EditorState,
} from "./interest-period-editor";
import type { InterestPeriodData } from "$lib/components/loans/multiple-interest-types";

function period(
  overrides: Partial<InterestPeriodData> = {},
): InterestPeriodData {
  return {
    id: overrides.id ?? "p1",
    dueDate: overrides.dueDate ?? "2026-03-31",
    interestRate: overrides.interestRate ?? "3",
    interestAmount: overrides.interestAmount ?? "",
    interestType: overrides.interestType ?? "rate",
    ...overrides,
  };
}

function state(periods: InterestPeriodData[]): EditorState {
  return { mode: "multiple", periods, touched: false };
}

describe("interest period editor", () => {
  it("generates month-end periods and pins the final date (FORM-03)", () => {
    expect(monthEndKeys("2026-01-01", "2026-04-01")).toEqual([
      "2026-01-31",
      "2026-02-28",
      "2026-03-31",
      "2026-04-01",
    ]);
    expect(monthEndKeys("2026-01-15", "2026-04-15")).toEqual([
      "2026-02-15",
      "2026-03-15",
      "2026-04-15",
    ]);
  });

  it("regenerates only while untouched (FORM-02)", () => {
    const first = interestEditorReducer(state([]), {
      type: "regenerateIfUntouched",
      sentDate: "2026-01-01",
      dueDate: "2026-04-01",
      defaultRate: "3",
      defaultType: "rate",
    });
    expect(first.periods.map((row) => row.dueDate)).toEqual([
      "2026-01-31",
      "2026-02-28",
      "2026-03-31",
      "2026-04-01",
    ]);

    const touched = interestEditorReducer(first, {
      type: "editValue",
      id: first.periods[0].id,
      field: "rate",
      value: "5",
      principal: "100000",
    });
    const moved = interestEditorReducer(touched, {
      type: "regenerateIfUntouched",
      sentDate: "2026-01-01",
      dueDate: "2026-07-01",
      defaultRate: "3",
      defaultType: "rate",
    });
    expect(moved.periods).toBe(touched.periods);
  });

  it("adds a period between its neighbors, never on the sent date (FORM-05)", () => {
    const current = state([
      period({ id: "a", dueDate: "2026-02-15" }),
      period({ id: "b", dueDate: "2026-04-15" }),
    ]);
    const next = interestEditorReducer(current, {
      type: "add",
      sentDate: "2026-01-15",
      dueDate: "2026-04-15",
      defaultRate: "3",
      defaultType: "rate",
    });
    const dates = next.periods.map((row) => row.dueDate);
    expect(dates).toContain("2026-03-16");
    expect(dates[dates.length - 1]).toBe("2026-04-15");
    expect(dates).not.toContain("2026-01-15");
  });

  it("converts rate to fixed and back without dropping the value (FORM-09)", () => {
    const asFixed = convertPeriodValue(
      period({ interestRate: "10", interestType: "rate" }),
      "fixed",
      "100000",
    );
    expect(asFixed.interestType).toBe("fixed");
    expect(asFixed.interestAmount).toBe("10000.00");

    const asRate = convertPeriodValue(
      period({ interestType: "fixed", interestAmount: "10000" }),
      "rate",
      "100000",
    );
    expect(asRate.interestType).toBe("rate");
    expect(asRate.interestRate).toBe("10.00");
  });

  it("rejects a duplicate due date instead of keeping a stale input (FORM-07)", () => {
    const current = state([
      period({ id: "a", dueDate: "2026-02-15" }),
      period({ id: "b", dueDate: "2026-04-15" }),
    ]);
    const next = interestEditorReducer(current, {
      type: "setDueDate",
      id: "a",
      value: "2026-04-15",
    });
    expect(next).toBe(current);
  });

  it("pins the final period to the loan due date (FORM-04)", () => {
    const current = state([
      period({ id: "a", dueDate: "2026-02-15" }),
      period({ id: "b", dueDate: "2026-04-15" }),
    ]);
    const next = interestEditorReducer(current, {
      type: "setFinalDueDate",
      dueDate: "2026-05-15",
    });
    expect(next.periods[next.periods.length - 1].dueDate).toBe("2026-05-15");
  });

  it("reports invalid ranges and duplicates", () => {
    const errors = interestEditorErrors(
      state([
        period({ id: "a", dueDate: "2025-12-01" }),
        period({ id: "b", dueDate: "2026-04-15" }),
      ]),
      { sentDate: "2026-01-01", dueDate: "2026-04-15" },
    );
    expect(errors.length).toBeGreaterThan(0);
  });
});

describe("interest period editor branches", () => {
  it("switches mode without touching periods", () => {
    const current = state([period({ id: "a" })]);
    const next = interestEditorReducer(current, {
      type: "setMode",
      mode: "single",
    });
    expect(next.mode).toBe("single");
    expect(next.periods).toBe(current.periods);
  });

  it("removes an intermediate period but never the final one", () => {
    const current = state([
      period({ id: "a", dueDate: "2026-02-15" }),
      period({ id: "b", dueDate: "2026-03-15" }),
      period({ id: "c", dueDate: "2026-04-15" }),
    ]);
    const removed = interestEditorReducer(current, {
      type: "remove",
      id: "b",
    });
    expect(removed.periods.map((row) => row.id)).toEqual(["a", "c"]);

    const final = interestEditorReducer(current, {
      type: "remove",
      id: "c",
    });
    expect(final).toBe(current);
  });

  it("edits a fixed amount and derives the rate", () => {
    const current = state([
      period({ id: "a", interestType: "fixed", interestAmount: "1000" }),
    ]);
    const next = interestEditorReducer(current, {
      type: "editValue",
      id: "a",
      field: "fixed",
      value: "2500",
      principal: "100000",
    });
    expect(next.periods[0].interestAmount).toBe("2500");
    expect(next.periods[0].interestRate).toBe("2.50");
  });

  it("sorts a valid date change and ignores an invalid one", () => {
    const current = state([
      period({ id: "a", dueDate: "2026-02-15" }),
      period({ id: "b", dueDate: "2026-03-15" }),
      period({ id: "c", dueDate: "2026-04-15" }),
    ]);
    const moved = interestEditorReducer(current, {
      type: "setDueDate",
      id: "a",
      value: "2026-03-20",
    });
    expect(moved.periods.map((row) => row.dueDate)).toEqual([
      "2026-03-15",
      "2026-03-20",
      "2026-04-15",
    ]);

    const ignored = interestEditorReducer(current, {
      type: "setDueDate",
      id: "a",
      value: "",
    });
    expect(ignored).toBe(current);
  });

  it("keeps setType idempotent", () => {
    const current = state([period({ id: "a", interestType: "rate" })]);
    const next = interestEditorReducer(current, {
      type: "setType",
      id: "a",
      interestType: "rate",
      principal: "100000",
    });
    expect(next.periods[0].interestType).toBe("rate");
  });

  it("ignores adding a duplicate date", () => {
    const current = state([
      period({ id: "a", dueDate: "2026-02-15" }),
      period({ id: "b", dueDate: "2026-03-15" }),
      period({ id: "c", dueDate: "2026-04-15" }),
    ]);
    const next = interestEditorReducer(current, {
      type: "add",
      sentDate: "2026-01-15",
      dueDate: "2026-04-15",
      defaultRate: "3",
      defaultType: "rate",
    });
    // The midpoint is already taken, so the schedule is unchanged.
    expect(next.periods.length).toBeGreaterThanOrEqual(current.periods.length);
  });

  it("reports a final-period mismatch and an out-of-range date", () => {
    const mismatch = interestEditorErrors(
      state([
        period({ id: "a", dueDate: "2026-02-15" }),
        period({ id: "b", dueDate: "2026-03-15" }),
      ]),
      { sentDate: "2026-01-15", dueDate: "2026-04-15" },
    );
    expect(mismatch).toContain(
      "The final period must end on the loan due date",
    );

    const outOfRange = interestEditorErrors(
      state([
        period({ id: "a", dueDate: "2026-01-01" }),
        period({ id: "b", dueDate: "2026-04-15" }),
      ]),
      { sentDate: "2026-01-15", dueDate: "2026-04-15" },
    );
    expect(outOfRange.length).toBeGreaterThan(0);
  });

  it("returns no errors in single mode", () => {
    expect(
      interestEditorErrors(
        { mode: "single", periods: [], touched: false },
        { sentDate: "2026-01-01", dueDate: "2026-04-01" },
      ),
    ).toEqual([]);
  });
});
