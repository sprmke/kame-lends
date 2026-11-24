/**
 * Shared schemas for payment, period, and status routes.
 * Every mutating money route validates with one of these before writing.
 */
import { z } from "zod";

const numeric = z
  .union([z.string(), z.number()])
  .refine(
    (value) => value !== "" && Number.isFinite(Number(value)),
    "Must be a number",
  )
  .transform((value) => Number(value));

const positive = numeric.refine((value) => value > 0, "Must be greater than 0");
const nonNegative = numeric.refine(
  (value) => value >= 0,
  "Must be zero or greater",
);

const dateInput = z
  .union([z.string(), z.date()])
  .refine((value) => {
    const time = value instanceof Date ? value.getTime() : Date.parse(value);
    return Number.isFinite(time);
  }, "Invalid date")
  .transform((value) => (value instanceof Date ? value : new Date(value)));

const optionalText = z
  .union([z.string(), z.null(), z.undefined()])
  .transform((value) => {
    const text = typeof value === "string" ? value.trim() : "";
    return text === "" ? null : text;
  });

const optionalId = z.preprocess((value) => {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : Number.NaN;
}, z.number().int().positive().nullable());

export const receivedPaymentCreateSchema = z.object({
  investorId: z.coerce.number().int().positive(),
  amount: positive,
  receivedDate: dateInput,
  interestPeriodId: optionalId.optional().default(null),
  receipts: z.unknown().optional(),
  receiptImageUrl: z.unknown().optional(),
  receiptExtractedData: z.unknown().optional(),
  notes: optionalText.optional(),
});

export const receivedPaymentPatchSchema = z.object({
  amount: positive,
  receivedDate: dateInput,
  notes: optionalText.optional(),
  receipts: z.unknown().optional(),
  receiptImageUrl: z.unknown().optional(),
  receiptExtractedData: z.unknown().optional(),
});

export const periodPaymentSchema = z.object({
  status: z.enum(["Pending", "Completed", "Overdue"]),
  receivedAmount: positive.optional(),
  receivedDate: dateInput.optional(),
  receipts: z.unknown().optional(),
  receiptImageUrl: z.unknown().optional(),
  receiptExtractedData: z.unknown().optional(),
  notes: optionalText.optional(),
});

export const consolidatePaymentSchema = z.object({
  amount: positive,
  receivedDate: dateInput,
  receipts: z.unknown().optional(),
  receiptImageUrl: z.unknown().optional(),
  receiptExtractedData: z.unknown().optional(),
  notes: optionalText.optional(),
});

export const loanStatusSchema = z.object({
  status: z.enum(["Completed", "auto"]),
  reason: optionalText.optional(),
  waivedAmount: nonNegative.nullable().optional(),
});

export const disbursementSchema = z.object({
  investorId: z.coerce.number().int().positive(),
  amount: positive,
  interestType: z.enum(["rate", "fixed"]).optional().default("rate"),
  interestValue: nonNegative.optional().default(0),
  sentDate: dateInput,
  isPaid: z.boolean().optional().default(true),
  receipts: z.unknown().optional(),
  receiptImageUrl: z.unknown().optional(),
  receiptExtractedData: z.unknown().optional(),
  notes: optionalText.optional(),
});

export const payTransactionSchema = z.object({
  transactionId: z.coerce.number().int().positive(),
  sentDate: dateInput.optional(),
});

type Issues = {
  issues: ReadonlyArray<{ path: ReadonlyArray<PropertyKey>; message: string }>;
};

export function firstSchemaError(error: Issues): string {
  return error.issues[0]?.message ?? "Invalid request";
}

export function schemaErrorMap(error: Issues): Record<string, string> {
  const result: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path.length > 0 ? issue.path.join(".") : "form";
    if (!result[key]) result[key] = issue.message;
  }
  return result;
}
