import { z } from "zod";
import { defineTool, ToolError } from "../agent/registry";
import type { ToolContext } from "../agent/context";
import { loanSource, moneyFact, readableDate } from "./shared";

const PHASE = z.enum(["all", "pending", "completed", "overdue"]).default("all");

export const getLoanScheduleTool = defineTool({
  name: "get_loan_schedule",
  description:
    "Due rows and interest periods for one loan, with expected, paid, remaining, and status per period. Use for 'when is the next payment', 'what is due', or 'which periods are unpaid'.",
  capability: "read",
  args: z
    .object({
      loanId: z.number().int().positive(),
      investorId: z.number().int().positive().optional(),
      phase: PHASE,
    })
    .strict(),
  label: (args) => `Loading schedule for loan #${args.loanId}`,
  async run(args, ctx: ToolContext) {
    const loan = await ctx.viewer.loanById(args.loanId);
    if (!loan) {
      throw new ToolError(
        "forbidden",
        "That loan is not visible to this user.",
        "Do not try other ids.",
      );
    }
    if (
      args.investorId &&
      !loan.loanInvestors.some(
        (allocation) => allocation.investorId === args.investorId,
      )
    ) {
      throw new ToolError(
        "forbidden",
        "That investor is not on this loan or is not visible.",
      );
    }
    const source = loanSource(loan);
    const ledger = ctx.viewer.ledger(loan);
    const investors = args.investorId
      ? ledger.investors.filter(
          (investor) => investor.investorId === args.investorId,
        )
      : ledger.investors;

    const periodRows = investors.flatMap((investor) =>
      investor.periods
        .filter((period) => {
          if (args.phase === "all") return true;
          if (args.phase === "pending") return period.remainingC > 0;
          if (args.phase === "completed") return period.status === "Completed";
          return period.status === "Overdue" || period.status === "Incomplete";
        })
        .map((period) => ({
          id: `${investor.investorId}-${period.id ?? period.dueDateKey}`,
          href: `/loans/${loan.id}`,
          cells: {
            due: readableDate(period.dueDateKey),
            investor: investor.name,
            expected: moneyFact(ctx, period.expectedC, "Expected", source)
              .display,
            paid: moneyFact(ctx, period.paidC, "Paid", source).display,
            remaining: moneyFact(ctx, period.remainingC, "Remaining", source)
              .display,
            status: period.status,
          },
        })),
    );

    const dueRows = ledger.dueRows
      .filter(
        (row) =>
          !args.investorId ||
          row.investors.some((i) => i.investorId === args.investorId),
      )
      .map((row) => ({
        id: row.dateKey,
        href: `/loans/${loan.id}`,
        cells: {
          due: readableDate(row.dateKey),
          principal: moneyFact(ctx, row.principalC, "Principal due", source)
            .display,
          interest: moneyFact(ctx, row.interestC, "Interest due", source)
            .display,
          total: moneyFact(ctx, row.totalC, "Total due", source).display,
        },
      }));

    if (periodRows.length === 0 && dueRows.length === 0) {
      throw new ToolError(
        "no_data",
        "This loan has no interest periods in that phase.",
        "State that there is nothing scheduled, and offer the loan summary instead.",
      );
    }

    const totalDueC = ledger.dueRows
      .filter(
        (row) =>
          !args.investorId ||
          row.investors.some((i) => i.investorId === args.investorId),
      )
      .reduce((sum, row) => sum + row.totalC, 0);
    const totalDue = moneyFact(ctx, totalDueC, "Total scheduled", source);
    const next = dueRows[0]?.cells.due;

    return {
      rows: dueRows.length > 0 ? dueRows : periodRows,
      columns:
        dueRows.length > 0
          ? [
              { key: "due", label: "Due" },
              { key: "principal", label: "Principal", align: "right" },
              { key: "interest", label: "Interest", align: "right" },
              { key: "total", label: "Total", align: "right" },
            ]
          : [
              { key: "due", label: "Due" },
              { key: "investor", label: "Investor" },
              { key: "expected", label: "Expected", align: "right" },
              { key: "paid", label: "Paid", align: "right" },
              { key: "remaining", label: "Remaining", align: "right" },
              { key: "status", label: "Status" },
            ],
      sources: [source],
      notes: [
        `${dueRows.length} due row(s), ${periodRows.length} period row(s).`,
        `Next due: ${next ?? "none"}.`,
      ],
      asOf: ctx.today,
      summary: `Total scheduled ${totalDue.display}`,
    };
  },
});
