/**
 * Shared loan write payloads.
 *
 * Used by the create/edit API routes (server) and available to the form for
 * client-side errors. Money values arrive as strings from inputs, so every
 * amount/rate is parsed once here and must be finite before any write runs.
 */
import { z } from "zod";

export const LOAN_TYPES = ["Lot Title", "OR/CR", "Agent"] as const;
export const LOAN_STATUSES = [
  "Partially Funded",
  "Fully Funded",
  "Overdue",
  "Completed",
] as const;
export const INTEREST_TYPES = ["rate", "fixed"] as const;

const numeric = z
  .union([z.string(), z.number()])
  .refine(
    (value) => value !== "" && Number.isFinite(Number(value)),
    "Must be a number",
  )
  .transform((value) => Number(value));

const nonNegative = numeric.refine(
  (value) => value >= 0,
  "Must be zero or greater",
);

const positive = numeric.refine((value) => value > 0, "Must be greater than 0");

const dateInput = z
  .union([z.string(), z.date()])
  .refine((value) => {
    const time = value instanceof Date ? value.getTime() : Date.parse(value);
    return Number.isFinite(time);
  }, "Invalid date")
  .transform((value) => (value instanceof Date ? value : new Date(value)));

/** Period values are allowed to be empty so the schema can explain why. */
const periodNumeric = z
  .union([z.string(), z.number()])
  .transform((value) =>
    typeof value === "string" && value.trim() === ""
      ? Number.NaN
      : Number(value),
  );

const optionalText = z
  .union([z.string(), z.null(), z.undefined()])
  .transform((value) => {
    const text = typeof value === "string" ? value.trim() : "";
    return text === "" ? null : text;
  });

const nullableId = z.preprocess((value) => {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : Number.NaN;
}, z.number().int().positive().nullable());

const optionalRowId = z.preprocess((value) => {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}, z.number().int().positive().nullable());

const nullableFiniteNumber = z.preprocess((value) => {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : Number.NaN;
}, z.number().nullable());

export const interestPeriodInputSchema = z
  .object({
    id: optionalRowId.optional(),
    dueDate: dateInput,
    interestRate: periodNumeric,
    interestType: z.enum(INTEREST_TYPES).default("rate"),
  })
  .superRefine((period, ctx) => {
    if (!Number.isFinite(period.interestRate)) {
      ctx.addIssue({
        code: "custom",
        path: ["interestRate"],
        message:
          period.interestType === "fixed"
            ? "Enter the fixed interest amount for this period."
            : "Enter the interest rate for this period.",
      });
      return;
    }
    if (!(period.interestRate > 0)) {
      ctx.addIssue({
        code: "custom",
        path: ["interestRate"],
        message:
          period.interestType === "fixed"
            ? "Enter the fixed interest amount for this period."
            : "Enter the interest rate for this period.",
      });
    }
  });

export const investorInputSchema = z
  .object({
    id: optionalRowId.optional(),
    investorId: z.coerce.number().int().positive(),
    amount: nonNegative,
    interestRate: nonNegative.default(0),
    interestType: z.enum(INTEREST_TYPES).default("rate"),
    sentDate: dateInput,
    isPaid: z.boolean().optional().default(true),
    hasMultipleInterest: z.boolean().optional().default(false),
    notes: optionalText.optional(),
    receipts: z.unknown().optional(),
    receiptImageUrl: z.unknown().optional(),
    receiptExtractedData: z.unknown().optional(),
    interestPeriods: z.array(interestPeriodInputSchema).optional().default([]),
  })
  .superRefine((investor, ctx) => {
    if (investor.hasMultipleInterest && investor.interestPeriods.length === 0) {
      ctx.addIssue({
        code: "custom",
        path: ["interestPeriods"],
        message: "Multiple interest periods are required",
      });
    }
  });

export const receivedPaymentInputSchema = z.object({
  id: z.union([z.string(), z.number()]).optional(),
  interestPeriodId: nullableId.optional().default(null),
  amount: positive,
  receivedDate: dateInput,
  notes: optionalText.optional(),
  receipts: z.unknown().optional(),
  receiptImageUrl: z.unknown().optional(),
  receiptExtractedData: z.unknown().optional(),
});

export const receivedPaymentsByInvestorSchema = z.object({
  investorId: z.coerce.number().int().positive(),
  receivedPayments: z.array(receivedPaymentInputSchema),
});

export const loanDataInputSchema = z.object({
  borrowerId: nullableId.default(null),
  loanName: z.string().trim().min(1, "Loan name is required").max(200),
  type: z.enum(LOAN_TYPES),
  dueDate: dateInput,
  freeLotSqm: nullableFiniteNumber.default(null),
  notes: optionalText.optional(),
});

export const loanWriteSchema = z
  .object({
    loanData: loanDataInputSchema,
    investorData: z
      .array(investorInputSchema)
      .min(1, "At least one investor is required"),
    receivedPaymentsByInvestor: z
      .array(receivedPaymentsByInvestorSchema)
      .optional()
      .default([]),
    contractCustomization: z.unknown().nullable().optional(),
    groupIds: z
      .array(z.coerce.number().int().positive())
      .optional()
      .default([]),
    /** Explicit confirmation for removing rows that still have payments. */
    confirmRemovals: z.boolean().optional().default(false),
  })
  .superRefine((payload, ctx) => {
    const due = payload.loanData.dueDate.getTime();

    payload.investorData.forEach((investor, investorIndex) => {
      if (investor.sentDate.getTime() > due) {
        ctx.addIssue({
          code: "custom",
          path: ["investorData", investorIndex, "sentDate"],
          message: "Sent date must be on or before the loan due date.",
        });
      }
      investor.interestPeriods.forEach((period, periodIndex) => {
        if (period.dueDate.getTime() > due) {
          ctx.addIssue({
            code: "custom",
            path: [
              "investorData",
              investorIndex,
              "interestPeriods",
              periodIndex,
              "dueDate",
            ],
            message:
              "Interest period due date cannot be after the loan due date.",
          });
        }
        if (period.dueDate.getTime() <= investor.sentDate.getTime()) {
          ctx.addIssue({
            code: "custom",
            path: [
              "investorData",
              investorIndex,
              "interestPeriods",
              periodIndex,
              "dueDate",
            ],
            message:
              "Interest period due date must be after the investor's sent date.",
          });
        }
      });
    });

    payload.receivedPaymentsByInvestor.forEach((entry) => {
      entry.receivedPayments.forEach((payment, index) => {
        if (payment.receivedDate.getTime() > due) {
          // A payment cannot be received after the loan is due, but it can be
          // recorded on the due date itself.
          ctx.addIssue({
            code: "custom",
            path: [
              "receivedPaymentsByInvestor",
              index,
              "receivedPayments",
              index,
              "receivedDate",
            ],
            message: "Received date cannot be after the loan due date.",
          });
        }
      });
    });
  });

export type LoanWritePayload = z.infer<typeof loanWriteSchema>;
export type InvestorInput = z.infer<typeof investorInputSchema>;
export type InterestPeriodInput = z.infer<typeof interestPeriodInputSchema>;
export type ReceivedPaymentInput = z.infer<typeof receivedPaymentInputSchema>;

type ZodIssues = {
  issues: ReadonlyArray<{ path: ReadonlyArray<PropertyKey>; message: string }>;
};

/** Flattens zod issues into a `field -> message` map for form display. */
export function loanWriteErrorMap(error: ZodIssues): Record<string, string> {
  const result: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path.length > 0 ? issue.path.join(".") : "form";
    if (!result[key]) result[key] = issue.message;
  }
  return result;
}

/** First readable message, for toast/`error` fields. */
export function firstLoanWriteError(error: ZodIssues): string {
  return error.issues[0]?.message ?? "Invalid loan data";
}
