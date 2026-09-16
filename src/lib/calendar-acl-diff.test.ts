import { describe, expect, it } from "vitest";
import { diffCalendarAcl } from "./calendar-acl-diff";

describe("diffCalendarAcl", () => {
  it("inserts missing readers and deletes extras", () => {
    const result = diffCalendarAcl({
      desiredEmails: ["a@x.com", "b@x.com"],
      actualRules: [
        { ruleId: "1", email: "a@x.com", role: "reader" },
        { ruleId: "2", email: "c@x.com", role: "reader" },
        { ruleId: "3", email: "sa@svc.gserviceaccount.com", role: "owner" },
      ],
      serviceAccountEmail: "sa@svc.gserviceaccount.com",
    });
    expect(result.toInsert).toEqual(["b@x.com"]);
    expect(result.toDelete.map((r) => r.email)).toEqual(["c@x.com"]);
  });
});
