/**
 * Email notification preferences shared by the Settings card and the API.
 * Keep bounds in one place so the UI and server reject the same values.
 */
import { z } from "zod";

export const EMAIL_REMINDER_DAY_OPTIONS = [1, 3, 5, 7, 14] as const;
export const DEFAULT_REMINDER_DAYS = [3, 1] as const;
export const MAX_REMINDER_DAYS = 5;
export const MIN_REMINDER_DAY = 0;
export const MAX_REMINDER_DAY = 30;
export const MIN_REPEAT_DAY = 1;
export const MAX_REPEAT_DAY = 30;

export type EmailReminderDay = (typeof EMAIL_REMINDER_DAY_OPTIONS)[number];

const boundedInteger = (min: number, max: number) =>
  z
    .union([z.string(), z.number()])
    .refine(
      (value) => value !== "" && Number.isFinite(Number(value)),
      "Must be a number",
    )
    .transform((value) => Math.trunc(Number(value)))
    .refine(
      (value) => value >= min && value <= max,
      `Must be between ${min} and ${max}`,
    );

const reminderDaysSchema = z
  .array(boundedInteger(MIN_REMINDER_DAY, MAX_REMINDER_DAY))
  .max(MAX_REMINDER_DAYS, `Choose at most ${MAX_REMINDER_DAYS} days`)
  .transform((days) => [...new Set(days)].sort((a, b) => b - a));

export const emailPreferencesPatchSchema = z
  .object({
    emailEnabled: z.boolean().optional(),
    notifyActivity: z.boolean().optional(),
    notifySigningRequests: z.boolean().optional(),
    notifySigningReminders: z.boolean().optional(),
    signingReminderFirstAfterDays: boundedInteger(
      0,
      MAX_REMINDER_DAY,
    ).optional(),
    signingReminderRepeatEveryDays: boundedInteger(
      MIN_REPEAT_DAY,
      MAX_REPEAT_DAY,
    ).optional(),
    notifyDueReminders: z.boolean().optional(),
    reminderDays: reminderDaysSchema.optional(),
    notifyDueToday: z.boolean().optional(),
    notifyOverdue: z.boolean().optional(),
    overdueRepeatEveryDays: boundedInteger(
      MIN_REPEAT_DAY,
      MAX_REPEAT_DAY,
    ).optional(),
    includeAmounts: z.boolean().optional(),
  })
  .strict();

export type EmailPreferencesPatch = z.infer<typeof emailPreferencesPatchSchema>;

/**
 * Normalize a lead-day list. Empty input falls back to the default so saving
 * with every checkbox clear cannot silently stop all upcoming reminders.
 */
export function normalizeReminderDays(
  days: number[] | null | undefined,
): number[] {
  const cleaned = [
    ...new Set(
      (days ?? [])
        .map((day) => Math.trunc(Number(day)))
        .filter((day) => Number.isFinite(day))
        .filter((day) => day >= MIN_REMINDER_DAY && day <= MAX_REMINDER_DAY),
    ),
  ].sort((a, b) => b - a);

  if (cleaned.length === 0) return [...DEFAULT_REMINDER_DAYS];
  return cleaned.slice(0, MAX_REMINDER_DAYS);
}

export function parseEmailPreferencesPatch(
  input: unknown,
):
  | { data: EmailPreferencesPatch; error?: never }
  | { data?: never; error: string } {
  const parsed = emailPreferencesPatchSchema.safeParse(input);
  if (!parsed.success) {
    return {
      error: parsed.error.issues[0]?.message ?? "Invalid email preferences",
    };
  }
  return { data: parsed.data };
}
