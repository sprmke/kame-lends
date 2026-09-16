import { describe, expect, it } from "vitest";
import { diffGroupMembers } from "./group-membership-diff";

describe("diffGroupMembers", () => {
  it("reports gained, lost, and unchanged", () => {
    const current = [
      {
        userId: "a",
        roles: ["owner" as const],
        name: "Ada",
        email: "a@x.com",
      },
      {
        userId: "b",
        roles: ["borrower" as const],
        name: "Bob",
        email: null,
      },
    ];
    const desired = [
      {
        userId: "a",
        roles: ["owner" as const],
        name: "Ada",
        email: "a@x.com",
      },
      {
        userId: "c",
        roles: ["investor" as const],
        name: "Cara",
        email: "c@x.com",
      },
    ];
    const diff = diffGroupMembers(current, desired);
    expect(diff.unchanged).toBe(1);
    expect(diff.gained.map((p) => p.userId)).toEqual(["c"]);
    expect(diff.lost.map((p) => p.userId)).toEqual(["b"]);
    expect(diff.gained[0]?.hasEmail).toBe(true);
    expect(diff.lost[0]?.hasEmail).toBe(false);
  });
});
