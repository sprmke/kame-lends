import { z } from "zod";
import {
  toDateKey,
  dateKeyToUtcMidnight,
  addDaysToKey,
} from "$lib/dates/business-date";
import { toCentavos } from "$lib/money/centavos";
import { defineTool, ToolError } from "../agent/registry";
import type { ToolContext } from "../agent/context";
import {
  countFact,
  dateKey,
  moneyFact,
  readableDate,
  capDateRange,
} from "./shared";

function bucketKey(key: string, bucket: "day" | "week" | "month"): string {
  if (bucket === "day") return key;
  if (bucket === "month") return key.slice(0, 7);
  const date = dateKeyToUtcMidnight(key);
  const day = date.getUTCDay();
  return addDaysToKey(key, day === 0 ? -6 : 1 - day);
}

export const getCashflowTool = defineTool({
  name: "get_cashflow",
  description:
    "Cash in and out from lending records between two dates: borrower payments received (in) and capital sent to borrowers (out), bucketed by day, week, or month. Use for 'cashflow last month'.",
  capability: "read",
  args: z
    .object({
      from: dateKey,
      to: dateKey,
      bucket: z.enum(["day", "week", "month"]).default("month"),
    })
    .strict(),
  label: () => "Building cashflow",
  async run(args, ctx: ToolContext) {
    if (args.to < args.from) {
      throw new ToolError("bad_args", "End date is before start date.");
    }
    if (!capDateRange(args.from, args.to)) {
      throw new ToolError(
        "too_broad",
        "That range is longer than a year.",
        "Narrow it to 366 days or less, or split it into smaller periods.",
      );
    }
    const loans = await ctx.viewer.allLoans();
    const buckets = new Map<string, { inflowC: number; outflowC: number }>();
    const ensure = (key: string) => {
      const existing = buckets.get(key) ?? { inflowC: 0, outflowC: 0 };
      buckets.set(key, existing);
      return existing;
    };

    for (const loan of loans) {
      for (const allocation of loan.loanInvestors) {
        if (!allocation.isPaid) continue;
        const key = toDateKey(allocation.sentDate);
        if (key < args.from || key > args.to) continue;
        ensure(bucketKey(key, args.bucket)).outflowC += toCentavos(
          allocation.amount,
        );
      }
      for (const allocation of loan.loanInvestors) {
        for (const payment of allocation.receivedPayments ?? []) {
          if (payment.deletedAt) continue;
          const key = toDateKey(payment.receivedDate);
          if (key < args.from || key > args.to) continue;
          ensure(bucketKey(key, args.bucket)).inflowC += toCentavos(
            payment.amount,
          );
        }
      }
    }

    const rows = [...buckets.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, value]) => ({
        id: key,
        cells: {
          period:
            args.bucket === "month"
              ? readableDate(`${key}-01`).replace(/^\w+ /, "")
              : readableDate(key),
          inflow: moneyFact(ctx, value.inflowC, "Inflow").display,
          outflow: moneyFact(ctx, value.outflowC, "Outflow").display,
          net: moneyFact(ctx, value.inflowC - value.outflowC, "Net").display,
        },
        raw: value,
      }));

    const inflowC = rows.reduce((sum, row) => sum + row.raw.inflowC, 0);
    const outflowC = rows.reduce((sum, row) => sum + row.raw.outflowC, 0);
    const net = moneyFact(ctx, inflowC - outflowC, "Net cashflow");
    moneyFact(ctx, inflowC, "Inflow");
    moneyFact(ctx, outflowC, "Outflow");
    countFact(ctx, rows.length, "Periods");

    return {
      chart: rows.map((row) => ({
        label: String(row.cells.period),
        inflowC: row.raw.inflowC,
        outflowC: row.raw.outflowC,
      })),
      rows: rows.map(({ raw: _raw, ...row }) => row),
      columns: [
        { key: "period", label: "Period" },
        { key: "inflow", label: "In", align: "right" },
        { key: "outflow", label: "Out", align: "right" },
        { key: "net", label: "Net", align: "right" },
      ],
      notes: [
        "Cashflow uses lending records: repayments received vs capital sent to borrowers.",
      ],
      asOf: ctx.today,
      summary: `Net cashflow ${net.display} from ${readableDate(args.from)} to ${readableDate(args.to)}`,
    };
  },
});
