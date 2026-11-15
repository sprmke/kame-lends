/**
 * Bank loan (debt) schemas. Debt routes validate before any write, same as
 * loan and payment routes.
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

const feeSchema = z.object({
  label: z.string().optional(),
  amount: numeric,
});

export const debtWriteSchema = z.object({
  investorId: z.coerce.number().int().positive(),
  name: z.string().trim().min(1, "Bank loan name is required"),
  amount: positive,
  date: dateInput,
  interestRate: nonNegative,
  interestInterval: z.enum(["Daily", "Weekly", "Monthly", "Annually"]),
  durationMonths: z.coerce.number().int().min(1).max(600).default(12),
  additionalFees: z.array(feeSchema).optional().default([]),
  notes: optionalText.optional(),
});

export const debtPaymentSchema = z.object({
  amount: positive,
  receivedDate: dateInput,
});

export const debtPeriodStatusSchema = z.object({
  status: z.enum(["Pending", "Completed", "Overdue"]),
  receivedAmount: positive.optional(),
  receivedDate: dateInput.optional(),
});

type Issues = {
  issues: ReadonlyArray<{ path: ReadonlyArray<PropertyKey>; message: string }>;
};

export function firstDebtError(error: Issues): string {
  return error.issues[0]?.message ?? "Invalid bank loan data";
}
