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

export const listPaymentsTool = defineTool({
  name: "list_payments",
  description:
    "Payments received across visible loans, with date, borrower, loan, and whether the payment is linked to an interest period. Use for 'payments this month' or 'unlinked payments'.",
  capability: "read",
  args: z
    .object({
      from: dateKey.optional(),
      to: dateKey.optional(),
      borrowerId: z.number().int().positive().optional(),
      loanId: z.number().int().positive().optional(),
      unlinked: z.boolean().default(false),
      limit: z.number().int().min(1).max(200).default(50),
    })
    .strict(),
  label: () => "Listing payments",
  async run(args, ctx: ToolContext) {
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
    let loans = await ctx.viewer.allLoans();
    if (args.loanId) {
      loans = loans.filter((loan) => loan.id === args.loanId);
      if (loans.length === 0) {
        throw new ToolError(
          "forbidden",
          "That loan is not visible to this user.",
        );
      }
    }
    if (args.borrowerId) {
      const known = (await ctx.viewer.borrowers()).some(
        (borrower) => borrower.id === args.borrowerId,
      );
      if (!known) {
        throw new ToolError("forbidden", "That borrower is not visible.");
      }
      loans = loans.filter((loan) => loan.borrowerId === args.borrowerId);
    }

    const payments = loans.flatMap((loan) =>
      loan.loanInvestors.flatMap((allocation) =>
        (allocation.receivedPayments ?? [])
          .filter((payment) => !payment.deletedAt)
          .filter(
            (payment) => !args.unlinked || payment.interestPeriodId == null,
          )
          .map((payment) => ({
            loan,
            payment,
            key: toDateKey(payment.receivedDate),
          })),
      ),
    );
    const filtered = payments
      .filter(
        (row) =>
          (!args.from || row.key >= args.from) &&
          (!args.to || row.key <= args.to),
      )
      .sort((a, b) => b.key.localeCompare(a.key));
    const totalC = filtered.reduce(
      (sum, row) => sum + toCentavos(row.payment.amount),
      0,
    );
    const total = moneyFact(ctx, totalC, "Payments in range");
    countFact(ctx, filtered.length, "Payments");

    return {
      rows: filtered.slice(0, args.limit).map((row) => ({
        id: row.payment.id ?? `${row.loan.id}-${row.key}`,
        href: `/loans/${row.loan.id}`,
        cells: {
          date: readableDate(row.key),
          borrower: row.loan.borrower?.name ?? "—",
          loan: row.loan.loanName,
          amount: moneyFact(
            ctx,
            toCentavos(row.payment.amount),
            "Payment",
            loanSource(row.loan),
          ).display,
          linked: row.payment.interestPeriodId == null ? "No" : "Yes",
        },
      })),
      columns: [
        { key: "date", label: "Date" },
        { key: "borrower", label: "Borrower" },
        { key: "loan", label: "Loan" },
        { key: "amount", label: "Amount", align: "right" },
        { key: "linked", label: "Linked" },
      ],
      sources: [
        ...new Map(
          filtered.map((row) => [row.loan.id, loanSource(row.loan)]),
        ).values(),
      ].slice(0, 6),
      notes:
        filtered.length === 0
          ? ["No payments match."]
          : [`${filtered.length} payment(s) in range.`],
      truncated: filtered.length > args.limit,
      asOf: ctx.today,
      summary: `${filtered.length} payments totaling ${total.display}`,
    };
  },
});
