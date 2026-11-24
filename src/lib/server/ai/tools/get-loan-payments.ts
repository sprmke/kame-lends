import { z } from "zod";
import { toDateKey } from "$lib/dates/business-date";
import { toCentavos } from "$lib/money/centavos";
import { defineTool, ToolError } from "../agent/registry";
import type { ToolContext } from "../agent/context";
import {
  countFact,
  dateKey,
  loanSource,
  moneyFact,
  readableDate,
  capDateRange,
} from "./shared";

export const getLoanPaymentsTool = defineTool({
  name: "get_loan_payments",
  description:
    "Payments received on one loan, with date, investor, amount, linked period, and whether the payment is unlinked. Use for payment history or 'did they pay'.",
  capability: "read",
  args: z
    .object({
      loanId: z.number().int().positive(),
      from: dateKey.optional(),
      to: dateKey.optional(),
    })
    .strict(),
  label: (args) => `Loading payments for loan #${args.loanId}`,
  async run(args, ctx: ToolContext) {
    const loan = await ctx.viewer.loanById(args.loanId);
    if (!loan) {
      throw new ToolError(
        "forbidden",
        "That loan is not visible to this user.",
      );
    }
    if (args.from && args.to && args.to < args.from) {
      throw new ToolError("bad_args", "End date is before start date.");
    }
    if (args.from && args.to && !capDateRange(args.from, args.to)) {
      throw new ToolError(
        "too_broad",
        "That range is longer than a year.",
        "Narrow it to 366 days or less, or split it into smaller periods.",
      );
    }
    const source = loanSource(loan);
    const rows = loan.loanInvestors
      .flatMap((allocation) =>
        (allocation.receivedPayments ?? []).map((payment) => ({
          allocation,
          payment,
          key: toDateKey(payment.receivedDate),
        })),
      )
      .filter((row) => !row.payment.deletedAt)
      .filter(
        (row) =>
          (!args.from || row.key >= args.from) &&
          (!args.to || row.key <= args.to),
      )
      .sort((a, b) => b.key.localeCompare(a.key));

    const totalC = rows.reduce(
      (sum, row) => sum + toCentavos(row.payment.amount),
      0,
    );
    const total = moneyFact(ctx, totalC, "Payments in range", source);
    countFact(ctx, rows.length, "Payments");

    return {
      rows: rows.slice(0, 100).map((row) => ({
        id: row.payment.id ?? `${row.allocation.id}-${row.key}`,
        href: `/loans/${loan.id}`,
        cells: {
          date: readableDate(row.key),
          investor: row.allocation.investor?.name ?? "—",
          amount: moneyFact(
            ctx,
            toCentavos(row.payment.amount),
            "Payment",
            source,
          ).display,
          period:
            row.payment.interestPeriodId == null
              ? "Unlinked"
              : `#${row.payment.interestPeriodId}`,
        },
      })),
      columns: [
        { key: "date", label: "Date" },
        { key: "investor", label: "Investor" },
        { key: "amount", label: "Amount", align: "right" },
        { key: "period", label: "Period" },
      ],
      sources: [source],
      notes: [
        `${rows.length} payment(s) in range.`,
        rows.some((row) => row.payment.interestPeriodId == null)
          ? "At least one payment is unlinked; the ledger applies unlinked money to the oldest open interest first (D-14)."
          : "",
      ].filter(Boolean),
      truncated: rows.length > 100,
      asOf: ctx.today,
      summary: `${rows.length} payments totaling ${total.display}`,
    };
  },
});
