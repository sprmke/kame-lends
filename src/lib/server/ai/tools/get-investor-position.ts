import { z } from "zod";
import { toDateKey } from "$lib/dates/business-date";
import { buildLoanLedger, investorLedger } from "$lib/money/ledger";
import { defineTool, ToolError } from "../agent/registry";
import type { ToolContext } from "../agent/context";
import {
  countFact,
  dateKey,
  investorHref,
  loanSource,
  moneyFact,
  readableDate,
} from "./shared";

export const getInvestorPositionTool = defineTool({
  name: "get_investor_position",
  description:
    "One investor's capital, interest expected and collected, outstanding balance, and per-loan positions. Use for 'how much has X invested', 'what did X earn'. Commission is separate and private.",
  capability: "read",
  args: z
    .object({
      investorId: z.number().int().positive(),
      asOf: dateKey.optional(),
    })
    .strict(),
  label: (args) => `Computing position for investor #${args.investorId}`,
  async run(args, ctx: ToolContext) {
    const { hasInvestorContactViewAccess } =
      await import("$lib/server/access-control");
    const allowed = await hasInvestorContactViewAccess(
      args.investorId,
      ctx.userId,
    );
    if (!allowed) {
      throw new ToolError(
        "forbidden",
        "That investor is not visible to this user.",
        "Do not try another id. Use find_party if the user gave a name.",
      );
    }
    const asOf = args.asOf ?? ctx.today;
    const loans = await ctx.viewer.allLoans();
    const rows = loans
      .map((loan) => {
        const ledger = buildLoanLedger(loan, {
          today: asOf,
          statusOverride:
            (loan as { statusOverride?: string | null }).statusOverride ===
            "Completed"
              ? "Completed"
              : null,
        });
        const position = investorLedger(ledger, args.investorId);
        return position ? { loan, position } : null;
      })
      .filter((row): row is NonNullable<typeof row> => row !== null);

    if (rows.length === 0) {
      throw new ToolError(
        "no_data",
        "That investor has no visible funded loans.",
        "Say there are no funded loans; do not invent amounts.",
      );
    }

    const capitalC = rows.reduce((sum, row) => sum + row.position.capitalC, 0);
    const expectedC = rows.reduce(
      (sum, row) => sum + row.position.interestExpectedC,
      0,
    );
    const collectedC = rows.reduce(
      (sum, row) => sum + row.position.interestPaidC,
      0,
    );
    const balanceC = rows.reduce((sum, row) => sum + row.position.balanceC, 0);
    const overdueC = rows.reduce((sum, row) => sum + row.position.overdueC, 0);
    const name = rows[0].position.name || `Investor #${args.investorId}`;
    const source = {
      type: "investor" as const,
      id: args.investorId,
      label: name,
      href: investorHref(args.investorId),
    };

    const capital = moneyFact(ctx, capitalC, "Capital out", source);
    moneyFact(ctx, expectedC, "Interest expected", source);
    const collected = moneyFact(ctx, collectedC, "Interest collected", source);
    const balance = moneyFact(ctx, balanceC, "Outstanding balance", source);
    moneyFact(ctx, overdueC, "Overdue", source);
    countFact(ctx, rows.length, "Funded loans");

    return {
      rows: rows.map((row) => ({
        id: row.loan.id,
        href: `/loans/${row.loan.id}`,
        cells: {
          loan: row.loan.loanName,
          status: row.loan.status,
          due: readableDate(toDateKey(row.loan.dueDate)),
          capital: moneyFact(
            ctx,
            row.position.capitalC,
            "Capital",
            loanSource(row.loan),
          ).display,
          balance: moneyFact(
            ctx,
            row.position.balanceC,
            "Balance",
            loanSource(row.loan),
          ).display,
          interest: moneyFact(
            ctx,
            row.position.interestPaidC,
            "Interest collected",
            loanSource(row.loan),
          ).display,
        },
      })),
      columns: [
        { key: "loan", label: "Loan" },
        { key: "status", label: "Status" },
        { key: "due", label: "Due" },
        { key: "capital", label: "Capital", align: "right" },
        { key: "balance", label: "Balance", align: "right" },
        { key: "interest", label: "Interest", align: "right" },
      ],
      calc: {
        title: `Investor position: ${name}`,
        asOf,
        definition:
          "Capital is this investor's funded allocation. Interest collected comes from the loan ledger, not from summing payment rows by hand.",
        groups: [
          {
            label: "Across funded loans",
            lines: [
              {
                label: "Capital out",
                display: capital.display,
                valueC: capitalC,
                source,
              },
              {
                label: "Interest expected",
                display: moneyFact(ctx, expectedC, "Interest expected", source)
                  .display,
                valueC: expectedC,
                source,
              },
              {
                label: "Interest collected",
                display: collected.display,
                valueC: collectedC,
                source,
              },
            ],
            subtotalDisplay: balance.display,
            subtotalC: balanceC,
          },
        ],
        totalDisplay: balance.display,
        totalC: balanceC,
        caveats: [`As of ${readableDate(asOf)}.`],
      },
      sources: [source, ...rows.slice(0, 4).map((row) => loanSource(row.loan))],
      notes: [
        `${rows.length} funded loan(s). Interest collected ${collected.display}.`,
      ],
      asOf,
      summary: `${name}: capital ${capital.display}, balance ${balance.display}`,
    };
  },
});
