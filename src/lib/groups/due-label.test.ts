import { describe, expect, it } from "vitest";
import { groupDuePrefix, isGroupDuePast } from "./due-label";

describe("group due label", () => {
  it("labels a past earliest due date as overdue", () => {
    const date = "2000-01-01";
    expect(isGroupDuePast(date)).toBe(true);
    expect(groupDuePrefix(date)).toBe("Overdue since");
  });

  it("labels a future earliest due date as next due", () => {
    const date = "2999-01-01";
    expect(isGroupDuePast(date)).toBe(false);
    expect(groupDuePrefix(date)).toBe("Next due");
  });

  it("ignores a missing date", () => {
    expect(isGroupDuePast(null)).toBe(false);
    expect(groupDuePrefix(undefined)).toBe("Next due");
  });
});
