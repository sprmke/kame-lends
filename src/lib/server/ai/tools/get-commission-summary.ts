import { z } from "zod";
import { toCentavos } from "$lib/money/centavos";
import { partyCommissionAmountForLoan } from "$lib/loan-list-summary";
import { defineTool } from "../agent/registry";
import type { ToolContext } from "../agent/context";
import { countFact, loanSource, moneyFact, readableDate } from "./shared";

export const getCommissionSummaryTool = defineTool({
  name: "get_commission_summary",
  description:
    "The viewer's own commission per loan. Private: only the signed-in user's commission is ever returned, never another party's. Use for 'how much is my commission'.",
  capability: "read",
  args: z.object({}).strict(),
  label: () => "Totaling your commission",
  async run(_args, ctx: ToolContext) {
    const loans = await ctx.viewer.allLoans();
    const rows = loans
      .map((loan) => ({
        loan,
        amountC: toCentavos(partyCommissionAmountForLoan(loan)),
        ledger: ctx.viewer.ledger(loan),
      }))
      .filter((row) => row.amountC > 0);
    const totalC = rows.reduce((sum, row) => sum + row.amountC, 0);
    const total = moneyFact(ctx, totalC, "Your commission");
    const earnedC = rows
      .filter((row) => row.ledger.status === "Completed")
      .reduce((sum, row) => sum + row.amountC, 0);
    moneyFact(ctx, earnedC, "Commission on completed loans");
    countFact(ctx, rows.length, "Loans with commission");

    return {
      rows: rows.map((row) => ({
        id: row.loan.id,
        href: `/loans/${row.loan.id}`,
        cells: {
          loan: row.loan.loanName,
          status: row.ledger.status,
          commission: moneyFact(
            ctx,
            row.amountC,
            "Commission",
            loanSource(row.loan),
          ).display,
        },
      })),
      columns: [
        { key: "loan", label: "Loan" },
        { key: "status", label: "Status" },
        { key: "commission", label: "Your commission", align: "right" },
      ],
      calc: {
        title: "Your commission",
        asOf: ctx.today,
        definition:
          "Commission = loan principal × your commission rate, or a fixed amount per loan. Only the signed-in user's commission is included.",
        groups: rows.map((row) => ({
          label: row.loan.loanName,
          lines: [
            {
              label: "Principal",
              display: moneyFact(
                ctx,
                row.ledger.principalC,
                "Principal",
                loanSource(row.loan),
              ).display,
              valueC: row.ledger.principalC,
              source: loanSource(row.loan),
            },
            {
              label: "Your commission",
              display: moneyFact(
                ctx,
                row.amountC,
                "Commission",
                loanSource(row.loan),
              ).display,
              valueC: row.amountC,
              source: loanSource(row.loan),
              note: row.loan.myCommission
                ? row.loan.myCommission.profitType === "fixed"
                  ? `${row.loan.myCommission.profitValue} fixed`
                  : `${row.loan.myCommission.profitValue}%`
                : undefined,
            },
          ],
          subtotalDisplay: moneyFact(
            ctx,
            row.amountC,
            "Commission",
            loanSource(row.loan),
          ).display,
          subtotalC: row.amountC,
        })),
        totalDisplay: total.display,
        totalC: totalC,
        caveats: [
          `As of ${readableDate(ctx.today)}.`,
          "Commission is private to you. Other parties' commission is never included.",
        ],
      },
      sources: rows.slice(0, 6).map((row) => loanSource(row.loan)),
      notes:
        rows.length === 0
          ? ["No commission is set on your visible loans."]
          : [
              `${rows.length} loan(s) with commission. This is your own commission only.`,
            ],
      asOf: ctx.today,
      summary: `Your commission totals ${total.display}`,
    };
  },
});
