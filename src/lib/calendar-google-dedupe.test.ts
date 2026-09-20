import { describe, expect, it } from "vitest";
import {
  duplicateIdsForSameKey,
  inferLoanEventKameKey,
  planLoanCalendarEventDeletions,
  planSummaryCalendarEventDeletions,
} from "./calendar-google-dedupe";
import type { LoanGoogleEventDraft } from "./calendar-events";

const drafts: LoanGoogleEventDraft[] = [
  {
    key: "loan-101-sent-2026-09-19",
    type: "sent",
    dateKey: "2026-09-19",
    investors: [],
    totalAmount: 400_000,
  },
];

describe("duplicateIdsForSameKey", () => {
  it("drops every id except the canonical one", () => {
    expect(
      duplicateIdsForSameKey([{ id: "a" }, { id: "b" }, { id: "c" }], "a"),
    ).toEqual(["b", "c"]);
  });
});

describe("inferLoanEventKameKey", () => {
  it("uses kameKind and start date when key is missing", () => {
    expect(
      inferLoanEventKameKey(
        {
          start: { date: "2026-09-19" },
          extendedProperties: {
            private: { kameKind: "sent" },
          },
        },
        101,
        drafts,
      ),
    ).toBe("loan-101-sent-2026-09-19");
  });
});

describe("planLoanCalendarEventDeletions", () => {
  it("removes duplicate keyed rows and stale keys", () => {
    const currentKeys = new Set(["loan-101-sent-2026-09-19"]);
    const plan = planLoanCalendarEventDeletions(
      [
        {
          id: "keep",
          extendedProperties: {
            private: { kameKey: "loan-101-sent-2026-09-19" },
          },
        },
        {
          id: "dup",
          extendedProperties: {
            private: { kameKey: "loan-101-sent-2026-09-19" },
          },
        },
        {
          id: "old",
          extendedProperties: {
            private: { kameKey: "loan-101-due-2026-10-01" },
          },
        },
      ],
      currentKeys,
      101,
      drafts,
    );
    expect(plan.sort()).toEqual(["dup", "old"]);
  });

  it("removes legacy unkeyed row when keyed canonical exists", () => {
    const currentKeys = new Set(["loan-101-sent-2026-09-19"]);
    const plan = planLoanCalendarEventDeletions(
      [
        {
          id: "keyed",
          extendedProperties: {
            private: { kameKey: "loan-101-sent-2026-09-19" },
          },
        },
        {
          id: "legacy",
          start: { date: "2026-09-19" },
          extendedProperties: { private: { kameKind: "sent" } },
        },
      ],
      currentKeys,
      101,
      drafts,
    );
    expect(plan).toEqual(["legacy"]);
  });
});

describe("planSummaryCalendarEventDeletions", () => {
  it("returns duplicate summary ids", () => {
    expect(
      planSummaryCalendarEventDeletions([{ id: "a" }, { id: "b" }], "a"),
    ).toEqual(["b"]);
  });
});
