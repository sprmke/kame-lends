import { z } from "zod";
import { toDateKey } from "$lib/dates/business-date";
import { toCentavos } from "$lib/money/centavos";
import { defineTool, ToolError } from "../agent/registry";
import type { ToolContext } from "../agent/context";
import { loanSource, moneyFact, readableDate } from "./shared";

export const getLoanTool = defineTool({
  name: "get_loan",
  description:
    "One loan with its parties, tranches, ledger totals, next due date, and status reason. Use after the user names or pins a loan, or when a question is about a single loan.",
  capability: "read",
  args: z.object({ loanId: z.number().int().positive() }).strict(),
  label: (args) => `Opening loan #${args.loanId}`,
  async run(args, ctx: ToolContext) {
    const loan = await ctx.viewer.loanById(args.loanId);
    if (!loan) {
      throw new ToolError(
        "forbidden",
        "That loan is not visible to this user.",
        "Do not try other ids. Answer with the loans the user can see.",
      );
    }
    const ledger = ctx.viewer.ledger(loan);
    const source = loanSource(loan);
    const principal = moneyFact(ctx, ledger.principalC, "Principal", source);
    const expected = moneyFact(
      ctx,
      ledger.interestExpectedC,
      "Interest expected",
      source,
    );
    const received = moneyFact(ctx, ledger.receivedC, "Received", source);
    const balance = moneyFact(
      ctx,
      ledger.balanceC,
      "Outstanding balance",
      source,
    );
    const overdue = moneyFact(ctx, ledger.overdueC, "Overdue", source);
    const due = ctx.facts.addDate(
      toDateKey(loan.dueDate),
      "Loan due date",
      source,
    );

    const unlinked = loan.loanInvestors
      .flatMap((allocation) => allocation.receivedPayments ?? [])
      .filter(
        (payment) => !payment.deletedAt && payment.interestPeriodId == null,
      );
    const caveats: string[] = [];
    if (unlinked.length > 0) {
      caveats.push(
        `${unlinked.length} payment is not linked to an interest period; the ledger applies it to the oldest open interest first (D-14).`,
      );
    }
    if (loan.statusOverride === "Completed") {
      const reason = (loan as { statusReason?: string | null }).statusReason;
      caveats.push(
        `Status is a manual Completed override${reason ? `: ${reason}` : ""} (D-7).`,
      );
    }
    if (ledger.balanceC < 0) {
      caveats.push(
        `This loan is overpaid by ${moneyFact(ctx, Math.abs(ledger.balanceC), "Overpayment", source).display}. State it as an overpayment, not a negative balance.`,
      );
    }
    const waived = Number(
      (loan as { waivedAmount?: string | number | null }).waivedAmount ?? 0,
    );
    if (Number.isFinite(waived) && waived > 0) {
      caveats.push(
        `A waiver of ${moneyFact(ctx, toCentavos(waived), "Waived amount", source).display} is recorded on this loan. The ledger applies waivers when the loan is completed.`,
      );
    }

    return {
      rows: loan.loanInvestors.map((allocation) => ({
        id: allocation.id,
        cells: {
          investor: allocation.investor?.name ?? "—",
          amount: moneyFact(
            ctx,
            toCentavos(allocation.amount),
            "Tranche",
            source,
          ).display,
          rate: `${allocation.interestRate}%`,
          sent: readableDate(toDateKey(allocation.sentDate)),
          disbursed: allocation.isPaid ? "Yes" : "No",
        },
      })),
      columns: [
        { key: "investor", label: "Investor" },
        { key: "amount", label: "Capital", align: "right" },
        { key: "rate", label: "Rate", align: "right" },
        { key: "sent", label: "Sent" },
        { key: "disbursed", label: "Disbursed" },
      ],
      calc: {
        title: `Balance: ${loan.loanName}`,
        asOf: ctx.today,
        definition:
          "balance = principal + interest expected − received. Interest rounds once per period, half-up (D-3).",
        groups: ledger.investors.map((investor) => ({
          label: investor.name || `Investor #${investor.investorId}`,
          lines: [
            {
              label: "Principal",
              display: moneyFact(ctx, investor.capitalC, "Principal", source)
                .display,
              valueC: investor.capitalC,
              source,
            },
            {
              label: "Interest expected",
              display: moneyFact(
                ctx,
                investor.interestExpectedC,
                "Interest expected",
                source,
              ).display,
              valueC: investor.interestExpectedC,
              source,
              note:
                investor.periods.length > 0
                  ? `${investor.periods.length} period(s); each rounds once (D-3)`
                  : undefined,
            },
            {
              label: "Received",
              display: `−${moneyFact(ctx, investor.receivedC, "Received", source).display}`,
              valueC: -investor.receivedC,
              source,
            },
          ],
          subtotalDisplay: moneyFact(ctx, investor.balanceC, "Balance", source)
            .display,
          subtotalC: investor.balanceC,
        })),
        totalDisplay: balance.display,
        totalC: ledger.balanceC,
        caveats,
      },
      sources: [source],
      notes: [
        `${loan.type}; status ${ledger.status}; due ${readableDate(toDateKey(loan.dueDate))}.`,
        `Next due ${ledger.nextDueKey ? readableDate(ledger.nextDueKey) : "none"}.`,
      ],
      asOf: ctx.today,
      summary: `${loan.loanName}: balance ${balance.display}, overdue ${overdue.display} (due ${due.display})`,
    };
  },
});
