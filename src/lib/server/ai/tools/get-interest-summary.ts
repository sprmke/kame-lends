import { z } from "zod";
import { toDateKey } from "$lib/dates/business-date";
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

export const getInterestSummaryTool = defineTool({
  name: "get_interest_summary",
  description:
    "Interest expected vs collected for periods due in a range, optionally for one investor. Collected means cash applied to interest, not scheduled interest. Use for 'interest collected this month' or 'expected vs received'.",
  capability: "read",
  args: z
    .object({
      from: dateKey,
      to: dateKey,
      investorId: z.number().int().positive().optional(),
    })
    .strict(),
  label: () => "Comparing interest expected and collected",
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
    if (args.investorId) {
      const { hasInvestorContactViewAccess } =
        await import("$lib/server/access-control");
      const allowed = await hasInvestorContactViewAccess(
        args.investorId,
        ctx.userId,
      );
      if (!allowed) {
        throw new ToolError("forbidden", "That investor is not visible.");
      }
    }
    const ledgers = await ctx.viewer.ledgers();
    const rows = ledgers.flatMap(({ loan, ledger }) =>
      ledger.investors
        .filter(
          (investor) =>
            !args.investorId || investor.investorId === args.investorId,
        )
        .flatMap((investor) =>
          investor.periods
            .filter(
              (period) =>
                period.dueDateKey >= args.from && period.dueDateKey <= args.to,
            )
            .map((period) => ({ loan, investor, period })),
        ),
    );

    const expectedC = rows.reduce((sum, row) => sum + row.period.expectedC, 0);
    const collectedC = rows.reduce(
      (sum, row) => sum + Math.min(row.period.paidC, row.period.expectedC),
      0,
    );
    const remainingC = rows.reduce(
      (sum, row) => sum + row.period.remainingC,
      0,
    );
    const expected = moneyFact(ctx, expectedC, "Interest expected");
    const collected = moneyFact(ctx, collectedC, "Interest collected");
    const remaining = moneyFact(ctx, remainingC, "Interest remaining");
    countFact(ctx, rows.length, "Interest periods");

    return {
      rows: rows.slice(0, 100).map((row) => ({
        id: `${row.loan.id}-${row.investor.investorId}-${row.period.id ?? row.period.dueDateKey}`,
        href: `/loans/${row.loan.id}`,
        cells: {
          due: readableDate(row.period.dueDateKey),
          investor: row.investor.name,
          loan: row.loan.loanName,
          expected: moneyFact(
            ctx,
            row.period.expectedC,
            "Expected",
            loanSource(row.loan),
          ).display,
          collected: moneyFact(
            ctx,
            row.period.paidC,
            "Collected",
            loanSource(row.loan),
          ).display,
          remaining: moneyFact(
            ctx,
            row.period.remainingC,
            "Remaining",
            loanSource(row.loan),
          ).display,
          status: row.period.status,
        },
      })),
      columns: [
        { key: "due", label: "Due" },
        { key: "investor", label: "Investor" },
        { key: "loan", label: "Loan" },
        { key: "expected", label: "Expected", align: "right" },
        { key: "collected", label: "Collected", align: "right" },
        { key: "remaining", label: "Remaining", align: "right" },
        { key: "status", label: "Status" },
      ],
      sources: [
        ...new Map(
          rows.map((row) => [row.loan.id, loanSource(row.loan)]),
        ).values(),
      ].slice(0, 6),
      notes: [
        `${rows.length} period(s). Expected ${expected.display}; collected ${collected.display}; remaining ${remaining.display}.`,
        "Collected is cash applied to interest (D-6), not the scheduled amount.",
      ],
      truncated: rows.length > 100,
      asOf: ctx.today,
      summary: `Collected ${collected.display} of ${expected.display} expected`,
    };
  },
});
