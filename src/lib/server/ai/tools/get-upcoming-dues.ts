import { z } from "zod";
import { addDaysToKey } from "$lib/dates/business-date";
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

export const getUpcomingDuesTool = defineTool({
  name: "get_upcoming_dues",
  description:
    "Due rows between two dates across visible loans, split into principal and interest. Defaults to the next 7 days. Use for 'what is due this week'.",
  capability: "read",
  args: z
    .object({
      from: dateKey.optional(),
      to: dateKey.optional(),
      groupBy: z.enum(["date", "loan"]).default("date"),
    })
    .strict(),
  label: () => "Checking upcoming dues",
  async run(args, ctx: ToolContext) {
    const from = args.from ?? ctx.today;
    const to = args.to ?? addDaysToKey(from, 7);
    if (to < from) {
      throw new ToolError("bad_args", "End date is before start date.");
    }
    if (!capDateRange(from, to)) {
      throw new ToolError(
        "too_broad",
        "That range is longer than a year.",
        "Narrow it to 366 days or less, or split it into smaller periods.",
      );
    }
    const ledgers = await ctx.viewer.ledgers();
    const entries = ledgers.flatMap(({ loan, ledger }) =>
      ledger.dueRows
        .filter((row) => row.dateKey >= from && row.dateKey <= to)
        .map((row) => ({ loan, row })),
    );

    const principalC = entries.reduce(
      (sum, entry) => sum + entry.row.principalC,
      0,
    );
    const interestC = entries.reduce(
      (sum, entry) => sum + entry.row.interestC,
      0,
    );
    const totalC = principalC + interestC;
    moneyFact(ctx, principalC, "Principal due");
    moneyFact(ctx, interestC, "Interest due");
    const totalFact = moneyFact(ctx, totalC, "Total due");
    countFact(ctx, entries.length, "Due rows");

    if (entries.length === 0) {
      return {
        notes: [
          `Nothing scheduled between ${readableDate(from)} and ${readableDate(to)}.`,
        ],
        asOf: ctx.today,
        summary: "Nothing due in that range",
      };
    }

    const rows =
      args.groupBy === "loan"
        ? [
            ...new Map(
              entries.map((entry) => [entry.loan.id, entry.loan]),
            ).values(),
          ].map((loan) => {
            const rowsForLoan = entries.filter(
              (entry) => entry.loan.id === loan.id,
            );
            return {
              id: loan.id,
              href: `/loans/${loan.id}`,
              cells: {
                loan: loan.loanName,
                borrower: loan.borrower?.name ?? "—",
                due: readableDate(rowsForLoan[0].row.dateKey),
                principal: moneyFact(
                  ctx,
                  rowsForLoan.reduce(
                    (sum, entry) => sum + entry.row.principalC,
                    0,
                  ),
                  "Principal",
                  loanSource(loan),
                ).display,
                interest: moneyFact(
                  ctx,
                  rowsForLoan.reduce(
                    (sum, entry) => sum + entry.row.interestC,
                    0,
                  ),
                  "Interest",
                  loanSource(loan),
                ).display,
                total: moneyFact(
                  ctx,
                  rowsForLoan.reduce((sum, entry) => sum + entry.row.totalC, 0),
                  "Total",
                  loanSource(loan),
                ).display,
              },
            };
          })
        : entries.map((entry) => ({
            id: `${entry.loan.id}-${entry.row.dateKey}`,
            href: `/loans/${entry.loan.id}`,
            cells: {
              loan: entry.loan.loanName,
              borrower: entry.loan.borrower?.name ?? "—",
              due: readableDate(entry.row.dateKey),
              principal: moneyFact(
                ctx,
                entry.row.principalC,
                "Principal",
                loanSource(entry.loan),
              ).display,
              interest: moneyFact(
                ctx,
                entry.row.interestC,
                "Interest",
                loanSource(entry.loan),
              ).display,
              total: moneyFact(
                ctx,
                entry.row.totalC,
                "Total",
                loanSource(entry.loan),
              ).display,
            },
          }));

    return {
      rows,
      columns: [
        { key: "loan", label: "Loan" },
        { key: "borrower", label: "Borrower" },
        { key: "due", label: "Due" },
        { key: "principal", label: "Principal", align: "right" },
        { key: "interest", label: "Interest", align: "right" },
        { key: "total", label: "Total", align: "right" },
      ],
      sources: [
        ...new Map(
          entries.map((entry) => [entry.loan.id, loanSource(entry.loan)]),
        ).values(),
      ].slice(0, 6),
      notes: [
        `${entries.length} due row(s) between ${readableDate(from)} and ${readableDate(to)}.`,
      ],
      asOf: ctx.today,
      summary: `${totalFact.display} due across ${entries.length} rows`,
    };
  },
});
