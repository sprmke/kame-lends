import { z } from "zod";
import { toDateKey } from "$lib/dates/business-date";
import { sumLedgers } from "$lib/money/ledger";
import { defineTool, ToolError } from "../agent/registry";
import type { ToolContext } from "../agent/context";
import {
  clampLimit,
  countFact,
  dateKey,
  loanSource,
  moneyFact,
  readableDate,
  capDateRange,
} from "./shared";

const STATUS = z
  .enum(["Partially Funded", "Fully Funded", "Overdue", "Completed"])
  .optional();
const TYPE = z.enum(["Lot Title", "OR/CR", "Agent"]).optional();
const SORT = z
  .enum(["dueDate", "balance", "created", "name"])
  .default("dueDate");

export const listLoansTool = defineTool({
  name: "list_loans",
  description:
    "List loans the viewer can see, with filters for status, type, borrower, investor, due range, and overdue-only. Returns loan rows plus ledger totals. Use for 'which loans are overdue', 'loans due this month', 'loans for X'.",
  capability: "read",
  args: z
    .object({
      status: STATUS,
      type: TYPE,
      borrowerId: z.number().int().positive().optional(),
      investorId: z.number().int().positive().optional(),
      dueFrom: dateKey.optional(),
      dueTo: dateKey.optional(),
      overdueOnly: z.boolean().default(false),
      sort: SORT,
      limit: z.number().int().min(1).max(200).default(50),
    })
    .strict(),
  label: (args) => {
    if (args.overdueOnly) return "Listing overdue loans";
    if (args.borrowerId) return "Listing that borrower's loans";
    if (args.investorId) return "Listing that investor's loans";
    return "Listing loans";
  },
  async run(args, ctx: ToolContext) {
    if (args.dueFrom && args.dueTo && args.dueTo < args.dueFrom) {
      throw new ToolError("bad_args", "End date is before start date.");
    }
    if (args.dueFrom && args.dueTo && !capDateRange(args.dueFrom, args.dueTo)) {
      throw new ToolError(
        "too_broad",
        "That due-date range is longer than a year.",
        "Narrow it to 366 days or less.",
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
        throw new ToolError(
          "forbidden",
          "That investor is outside what this user can see.",
          "Do not try another id. Answer with what the user can see.",
        );
      }
    }
    const limit = clampLimit(args.limit);
    const ledgers = await ctx.viewer.ledgers();
    let rows = ledgers.filter(({ loan, ledger }) => {
      if (args.borrowerId && loan.borrowerId !== args.borrowerId) return false;
      if (
        args.investorId &&
        !loan.loanInvestors.some(
          (allocation) => allocation.investorId === args.investorId,
        )
      ) {
        return false;
      }
      if (args.status && ledger.status !== args.status) return false;
      if (args.type && loan.type !== args.type) return false;
      const dueKey = toDateKey(loan.dueDate);
      if (args.dueFrom && dueKey < args.dueFrom) return false;
      if (args.dueTo && dueKey > args.dueTo) return false;
      if (args.overdueOnly && ledger.overdueC <= 0) return false;
      return true;
    });

    if (args.borrowerId && rows.length === 0) {
      const known = (await ctx.viewer.borrowers()).some(
        (borrower) => borrower.id === args.borrowerId,
      );
      if (!known) {
        throw new ToolError("forbidden", "That borrower is not visible.");
      }
    }

    rows = rows.sort((a, b) => {
      if (args.sort === "balance") return b.ledger.balanceC - a.ledger.balanceC;
      if (args.sort === "name")
        return a.loan.loanName.localeCompare(b.loan.loanName);
      if (args.sort === "created")
        return (
          new Date(b.loan.createdAt).getTime() -
          new Date(a.loan.createdAt).getTime()
        );
      return toDateKey(a.loan.dueDate).localeCompare(toDateKey(b.loan.dueDate));
    });

    const truncated = rows.length > limit;
    const visible = rows.slice(0, limit);
    // Totals cover every matched loan, not just the rendered page, so a
    // truncated list can never under-report the balance it summarizes.
    const totals = sumLedgers(rows.map((row) => row.ledger));

    const balanceFact = moneyFact(
      ctx,
      totals.balanceC,
      "Outstanding on matched loans",
    );
    moneyFact(ctx, totals.principalC, "Principal on matched loans");
    moneyFact(ctx, totals.overdueC, "Overdue on matched loans");
    countFact(ctx, rows.length, "Matched loans");

    return {
      rows: visible.map(({ loan, ledger }) => ({
        id: loan.id,
        href: `/loans/${loan.id}`,
        cells: {
          loan: loan.loanName,
          borrower: loan.borrower?.name ?? "—",
          status: ledger.status,
          due: readableDate(toDateKey(loan.dueDate)),
          principal: moneyFact(
            ctx,
            ledger.principalC,
            "Principal",
            loanSource(loan),
          ).display,
          balance: moneyFact(ctx, ledger.balanceC, "Balance", loanSource(loan))
            .display,
          overdue:
            ledger.overdueC > 0
              ? moneyFact(ctx, ledger.overdueC, "Overdue", loanSource(loan))
                  .display
              : "—",
        },
      })),
      columns: [
        { key: "loan", label: "Loan" },
        { key: "borrower", label: "Borrower" },
        { key: "status", label: "Status" },
        { key: "due", label: "Due" },
        { key: "principal", label: "Principal", align: "right" },
        { key: "balance", label: "Balance", align: "right" },
        { key: "overdue", label: "Overdue", align: "right" },
      ],
      sources: visible.slice(0, 6).map((row) => loanSource(row.loan)),
      notes: truncated
        ? [`Showing ${limit} of ${rows.length} loans.`]
        : [`${rows.length} matching loans.`],
      truncated,
      asOf: ctx.today,
      summary: `Balance ${balanceFact.display} across ${rows.length} loans`,
    };
  },
});
