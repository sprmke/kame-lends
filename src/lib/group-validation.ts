import { z } from "zod";
import { GROUP_COLOR_KEYS } from "$lib/groups/group-colors";

const colorSchema = z.enum(GROUP_COLOR_KEYS);

export const groupRuleInputSchema = z.object({
  partyType: z.enum(["investor", "borrower"]),
  contactId: z.number().int().positive(),
});

export const createGroupBodySchema = z.object({
  name: z.string().trim().min(1).max(120),
  color: colorSchema.optional().default("orange"),
  description: z.string().trim().max(2000).optional().nullable(),
  notes: z.string().trim().max(2000).optional().nullable(),
  loanIds: z.array(z.number().int().positive()).optional().default([]),
  rules: z.array(groupRuleInputSchema).optional().default([]),
  createCalendar: z.boolean().optional().default(true),
});

export const updateGroupBodySchema = z.object({
  name: z.string().trim().min(1).max(120).optional(),
  color: colorSchema.optional(),
  description: z.string().trim().max(2000).optional().nullable(),
  notes: z.string().trim().max(2000).optional().nullable(),
});

export const accessPreviewBodySchema = z.object({
  addLoanIds: z.array(z.number().int().positive()).optional().default([]),
  removeLoanIds: z.array(z.number().int().positive()).optional().default([]),
  rules: z.array(groupRuleInputSchema).optional().default([]),
  /** Wizard: loans that will be in the new group (no existing group). */
  loanIds: z.array(z.number().int().positive()).optional().default([]),
});

export const bulkLoanIdsBodySchema = z.object({
  loanIds: z.array(z.number().int().positive()).min(1),
});

export const setLoanGroupsBodySchema = z.object({
  groupIds: z.array(z.number().int().positive()),
});

export const createRuleBodySchema = groupRuleInputSchema.extend({
  applyToExisting: z.boolean().optional().default(true),
});

export const reminderDaysSchema = z
  .array(z.number().int().min(0).max(30))
  .max(5)
  .transform((days) => [...new Set(days)].sort((a, b) => b - a));

const telegramTemplatesSchema = z.record(z.string(), z.string()).optional();

export const connectTelegramBodySchema = z.object({
  botToken: z.string().trim().min(1).optional().nullable(),
  chatId: z.string().trim().min(1),
});

export const updateTelegramBodySchema = z.object({
  enabled: z.boolean().optional(),
  notifyUpcoming: z.boolean().optional(),
  reminderDays: reminderDaysSchema.optional(),
  notifyDueToday: z.boolean().optional(),
  notifyOverdue: z.boolean().optional(),
  overdueRepeatEveryDays: z.number().int().min(1).max(30).optional(),
  notifyDailyDigest: z.boolean().optional(),
  notifyActivity: z.boolean().optional(),
  includeAmounts: z.boolean().optional(),
  botToken: z.string().trim().min(1).optional().nullable(),
  chatId: z.string().trim().min(1).optional().nullable(),
  templates: telegramTemplatesSchema,
});

export function parseJsonBody<T>(
  schema: z.ZodType<T>,
  body: unknown,
): { data: T } | { error: string } {
  const result = schema.safeParse(body);
  if (!result.success) {
    const first = result.error.issues[0];
    return { error: first?.message ?? "Invalid request body" };
  }
  return { data: result.data };
}
