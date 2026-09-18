import { describe, expect, it } from "vitest";
import { pushReminderPath } from "$lib/server/push/user-reminders";

describe("pushReminderPath", () => {
  it("routes overdue reminders to commissioned scope", () => {
    expect(pushReminderPath("overdue")).toBe("/loans?scope=commissioned");
  });

  it("routes other reminder kinds to dashboard", () => {
    expect(pushReminderPath("upcoming")).toBe("/dashboard");
    expect(pushReminderPath("due_today")).toBe("/dashboard");
    expect(pushReminderPath("digest")).toBe("/dashboard");
  });
});
