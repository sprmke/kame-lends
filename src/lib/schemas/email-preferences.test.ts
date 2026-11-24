import { describe, expect, it } from "vitest";
import {
  DEFAULT_REMINDER_DAYS,
  normalizeReminderDays,
  parseEmailPreferencesPatch,
} from "$lib/schemas/email-preferences";

describe("email preferences schema", () => {
  it("accepts a full valid patch", () => {
    const parsed = parseEmailPreferencesPatch({
      emailEnabled: true,
      notifyActivity: false,
      notifySigningRequests: true,
      notifySigningReminders: true,
      signingReminderFirstAfterDays: 3,
      signingReminderRepeatEveryDays: 4,
      notifyDueReminders: true,
      reminderDays: [7, 3, 1],
      notifyDueToday: true,
      notifyOverdue: false,
      overdueRepeatEveryDays: 2,
      includeAmounts: false,
    });

    expect("data" in parsed).toBe(true);
    if (parsed.data) {
      expect(parsed.data.reminderDays).toEqual([7, 3, 1]);
    }
  });

  it("dedupes and sorts lead days", () => {
    const parsed = parseEmailPreferencesPatch({ reminderDays: [1, 3, 3, 7] });
    expect("data" in parsed).toBe(true);
    if (parsed.data) expect(parsed.data.reminderDays).toEqual([7, 3, 1]);
  });

  it("rejects out-of-range repeat days", () => {
    const parsed = parseEmailPreferencesPatch({
      signingReminderRepeatEveryDays: 0,
    });
    expect("error" in parsed).toBe(true);
  });

  it("rejects unknown keys", () => {
    const parsed = parseEmailPreferencesPatch({ surprise: true });
    expect("error" in parsed).toBe(true);
  });

  it("normalizes empty lead days to the default", () => {
    expect(normalizeReminderDays([])).toEqual([...DEFAULT_REMINDER_DAYS]);
    expect(normalizeReminderDays(null)).toEqual([...DEFAULT_REMINDER_DAYS]);
  });

  it("caps lead days at five entries", () => {
    expect(normalizeReminderDays([1, 2, 3, 4, 5, 6])).toHaveLength(5);
  });
});
