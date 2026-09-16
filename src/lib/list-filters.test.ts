import { describe, expect, it } from "vitest";
import { matchesParticipantExposureFilter } from "./list-filters";

describe("matchesParticipantExposureFilter", () => {
  const loans = [
    { status: "Fully Funded" },
    { status: "Completed" },
    { status: "Overdue" },
  ];

  it("matches all", () => {
    expect(matchesParticipantExposureFilter([], "all")).toBe(true);
    expect(matchesParticipantExposureFilter(loans, "all")).toBe(true);
  });

  it("matches active (non-completed)", () => {
    expect(matchesParticipantExposureFilter([], "active")).toBe(false);
    expect(
      matchesParticipantExposureFilter([{ status: "Completed" }], "active"),
    ).toBe(false);
    expect(
      matchesParticipantExposureFilter(
        [{ status: "Partially Funded" }],
        "active",
      ),
    ).toBe(true);
    expect(matchesParticipantExposureFilter(loans, "active")).toBe(true);
  });

  it("matches overdue only", () => {
    expect(
      matchesParticipantExposureFilter([{ status: "Fully Funded" }], "overdue"),
    ).toBe(false);
    expect(
      matchesParticipantExposureFilter([{ status: "Overdue" }], "overdue"),
    ).toBe(true);
  });
});
