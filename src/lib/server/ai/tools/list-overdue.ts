import { z } from "zod";
import { toDateKey, daysBetweenKeys } from "$lib/dates/business-date";
import { defineTool } from "../agent/registry";
import type { ToolContext } from "../agent/context";
import {
  countFact,
  dateKey,
  loanSource,
  moneyFact,
  readableDate,
} from "./shared";

function bucketFor(days: number): string {
  if (days <= 7) return "1-7 days";
  if (days <= 30) return "8-30 days";
  if (days <= 60) return "31-60 days";
  if (days <= 90) return "61-90 days";
  return "90+ days";
}

export const listOverdueTool = defineTool({
  name: "list_overdue",
  description:
    "Overdue loans with how many days late, the overdue amount, and aging buckets. Overdue starts the day after the due date in Manila (D-2). Use for 'who is late' or 'overdue total'.",
  capability: "read",
  args: z
    .object({
      asOf: dateKey.optional(),
      minDays: z.number().int().min(0).max(3_650).default(0),
    })
    .strict(),
  label: () => "Listing overdue loans",
  async run(args, ctx: ToolContext) {
    const asOf = args.asOf ?? ctx.today;
    const ledgers = await ctx.viewer.ledgers();
    const rows = ledgers
      .map((row) => {
        const openPeriodDates = row.ledger.investors
          .flatMap((investor) =>
            investor.periods
              .filter((period) => period.remainingC > 0)
              .map((period) => period.dueDateKey),
          )
          .filter((key) => key < asOf)
          .sort();
        const oldest =
          openPeriodDates[0] ??
          (toDateKey(row.loan.dueDate) < asOf
            ? toDateKey(row.loan.dueDate)
            : asOf);
        const days = Math.max(0, daysBetweenKeys(oldest, asOf));
        return { ...row, oldest, days };
      })
      .filter((row) => row.ledger.overdueC > 0 && row.days >= args.minDays)
      .sort((a, b) => b.ledger.overdueC - a.ledger.overdueC);

    const totalC = rows.reduce((sum, row) => sum + row.ledger.overdueC, 0);
    const total = moneyFact(ctx, totalC, "Overdue total");
    countFact(ctx, rows.length, "Overdue loans");

    return {
      rows: rows.map((row) => ({
        id: row.loan.id,
        href: `/loans/${row.loan.id}`,
        cells: {
          loan: row.loan.loanName,
          borrower: row.loan.borrower?.name ?? "—",
          due: readableDate(row.oldest),
          daysLate: row.days,
          bucket: bucketFor(row.days),
          overdue: moneyFact(
            ctx,
            row.ledger.overdueC,
            "Overdue",
            loanSource(row.loan),
          ).display,
        },
      })),
      columns: [
        { key: "loan", label: "Loan" },
        { key: "borrower", label: "Borrower" },
        { key: "due", label: "Oldest due" },
        { key: "daysLate", label: "Days late", align: "right" },
        { key: "bucket", label: "Aging" },
        { key: "overdue", label: "Overdue", align: "right" },
      ],
      sources: rows.slice(0, 6).map((row) => loanSource(row.loan)),
      notes:
        rows.length === 0
          ? [`Nothing is overdue as of ${readableDate(asOf)}.`]
          : [`${rows.length} overdue loan(s) as of ${readableDate(asOf)}.`],
      asOf,
      summary: `${rows.length} overdue loans totaling ${total.display}`,
    };
  },
});
