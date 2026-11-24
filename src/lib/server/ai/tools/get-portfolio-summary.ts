import { z } from "zod";
import { toCentavos } from "$lib/money/centavos";
import { sumLedgers } from "$lib/money/ledger";
import { computePortfolioCapitalStats } from "$lib/loan-list-summary";
import { defineTool } from "../agent/registry";
import type { ToolContext } from "../agent/context";
import { countFact, moneyFact, readableDate } from "./shared";

export const getPortfolioSummaryTool = defineTool({
  name: "get_portfolio_summary",
  description:
    "Portfolio totals the viewer can see: principal, active capital, interest expected and collected, outstanding balance, overdue total, and counts by status. Principal follows the dashboard's deployed-capital definition. Use for broad questions like 'how is my portfolio doing'.",
  capability: "read",
  args: z.object({}).strict(),
  label: () => "Totaling the portfolio",
  async run(_args, ctx: ToolContext) {
    const loans = await ctx.viewer.loans();
    const ledgers = loans.map((loan) => ({
      loan,
      ledger: ctx.viewer.ledger(loan),
    }));
    const totals = sumLedgers(ledgers.map((row) => row.ledger));
    const open = ledgers.filter((row) => row.ledger.status !== "Completed");
    const overdue = ledgers.filter((row) => row.ledger.overdueC > 0);
    const countByStatus = new Map<string, number>();
    for (const row of ledgers) {
      countByStatus.set(
        row.ledger.status,
        (countByStatus.get(row.ledger.status) ?? 0) + 1,
      );
    }

    // Same function the dashboard uses, so "Total Principal" and "Active"
    // cannot disagree between the screen and the assistant.
    const capital = computePortfolioCapitalStats(loans);
    const totalPrincipalC = toCentavos(capital.totalPrincipal);
    const activePrincipalC = toCentavos(capital.activePrincipal);
    const interestEstimateC = toCentavos(capital.interestEstimate);
    const interestEarnedC = toCentavos(capital.interestEarned);

    moneyFact(ctx, totalPrincipalC, "Portfolio principal");
    moneyFact(ctx, activePrincipalC, "Active capital");
    const expected = moneyFact(ctx, interestEstimateC, "Interest expected");
    const collected = moneyFact(ctx, interestEarnedC, "Interest collected");
    const outstanding = moneyFact(ctx, totals.balanceC, "Outstanding balance");
    moneyFact(ctx, totals.overdueC, "Overdue total");
    countFact(ctx, ledgers.length, "Loans");
    countFact(ctx, open.length, "Open loans");
    countFact(ctx, overdue.length, "Overdue loans");

    return {
      rows: [...countByStatus.entries()].map(([status, count]) => ({
        id: status,
        cells: { status, loans: count },
      })),
      columns: [
        { key: "status", label: "Status" },
        { key: "loans", label: "Loans", align: "right" },
      ],
      calc: {
        title: "Portfolio totals",
        asOf: ctx.today,
        definition:
          "Total principal is peak concurrent disbursed capital (same as the dashboard). Outstanding = principal + interest expected - received from the loan ledgers. Overdue starts the day after a due date (D-2).",
        groups: [
          {
            label: "Deployed capital (dashboard)",
            lines: [
              {
                label: "Total principal",
                display: moneyFact(ctx, totalPrincipalC, "Portfolio principal")
                  .display,
                valueC: totalPrincipalC,
              },
              {
                label: "Active principal",
                display: moneyFact(ctx, activePrincipalC, "Active capital")
                  .display,
                valueC: activePrincipalC,
              },
              {
                label: "Interest estimate",
                display: expected.display,
                valueC: interestEstimateC,
              },
              {
                label: "Interest collected",
                display: collected.display,
                valueC: interestEarnedC,
              },
            ],
          },
          {
            label: "Outstanding (ledger)",
            lines: [
              {
                label: "Principal",
                display: moneyFact(ctx, totals.principalC, "Principal").display,
                valueC: totals.principalC,
              },
              {
                label: "Interest expected",
                display: moneyFact(
                  ctx,
                  totals.interestExpectedC,
                  "Interest expected",
                ).display,
                valueC: totals.interestExpectedC,
              },
              {
                label: "Received",
                display: moneyFact(ctx, totals.receivedC, "Received").display,
                valueC: totals.receivedC,
              },
            ],
            subtotalDisplay: outstanding.display,
            subtotalC: totals.balanceC,
          },
        ],
        totalDisplay: outstanding.display,
        totalC: totals.balanceC,
        caveats: [
          `Figures follow the app's ledger rules as of ${readableDate(ctx.today)}.`,
        ],
      },
      notes: [`${ledgers.length} visible loans, ${open.length} open.`],
      sources: ledgers.slice(0, 5).map((row) => ({
        type: "loan" as const,
        id: row.loan.id,
        label: row.loan.loanName,
        href: `/loans/${row.loan.id}`,
      })),
      asOf: ctx.today,
      summary: `Outstanding ${outstanding.display} across ${ledgers.length} loans`,
    };
  },
});
