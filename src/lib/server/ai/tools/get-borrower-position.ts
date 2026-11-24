import { z } from "zod";
import { toDateKey } from "$lib/dates/business-date";
import { buildLoanLedger, sumLedgers } from "$lib/money/ledger";
import { defineTool, ToolError } from "../agent/registry";
import type { ToolContext } from "../agent/context";
import {
  borrowerHref,
  countFact,
  dateKey,
  loanSource,
  moneyFact,
  readableDate,
} from "./shared";

export const getBorrowerPositionTool = defineTool({
  name: "get_borrower_position",
  description:
    "One borrower across their loans: principal, interest expected, received, outstanding balance, overdue, and next due. Use for 'how much does X still owe'. Never guess the borrower id; use find_party first.",
  capability: "read",
  args: z
    .object({
      borrowerId: z.number().int().positive(),
      asOf: dateKey.optional(),
      includeCompleted: z.boolean().default(true),
    })
    .strict(),
  label: (args) => `Computing balance for borrower #${args.borrowerId}`,
  async run(args, ctx: ToolContext) {
    const borrowers = await ctx.viewer.borrowers();
    const borrower = borrowers.find((row) => row.id === args.borrowerId);
    if (!borrower) {
      throw new ToolError(
        "forbidden",
        "That borrower is not visible to this user.",
        "Use find_party with a name instead of guessing ids.",
      );
    }
    const asOf = args.asOf ?? ctx.today;
    const loans = (await ctx.viewer.allLoans()).filter(
      (loan) => loan.borrowerId === borrower.id,
    );
    const rows = loans
      .map((loan) => ({
        loan,
        ledger: buildLoanLedger(loan, {
          today: asOf,
          statusOverride:
            (loan as { statusOverride?: string | null }).statusOverride ===
            "Completed"
              ? "Completed"
              : null,
        }),
      }))
      .filter(
        (row) => args.includeCompleted || row.ledger.status !== "Completed",
      );
    if (rows.length === 0) {
      throw new ToolError(
        "no_data",
        "This borrower has no visible loans.",
        "Say there are no loans for this borrower; do not invent one.",
      );
    }

    const totals = sumLedgers(rows.map((row) => row.ledger));
    const balance = moneyFact(ctx, totals.balanceC, "Outstanding balance");
    const overdue = moneyFact(ctx, totals.overdueC, "Overdue");
    const interest = moneyFact(
      ctx,
      totals.interestExpectedC,
      "Interest expected",
    );
    const received = moneyFact(ctx, totals.receivedC, "Received");
    countFact(ctx, rows.length, "Loans");
    const nextKey = rows
      .map((row) => row.ledger.nextDueKey)
      .filter((key): key is string => Boolean(key))
      .sort()[0];

    return {
      rows: rows.map((row) => ({
        id: row.loan.id,
        href: `/loans/${row.loan.id}`,
        cells: {
          loan: row.loan.loanName,
          status: row.ledger.status,
          due: readableDate(toDateKey(row.loan.dueDate)),
          principal: moneyFact(
            ctx,
            row.ledger.principalC,
            "Principal",
            loanSource(row.loan),
          ).display,
          balance: moneyFact(
            ctx,
            row.ledger.balanceC,
            "Balance",
            loanSource(row.loan),
          ).display,
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
        { key: "status", label: "Status" },
        { key: "due", label: "Due" },
        { key: "principal", label: "Principal", align: "right" },
        { key: "balance", label: "Balance", align: "right" },
        { key: "overdue", label: "Overdue", align: "right" },
      ],
      calc: {
        title: `Pending balance: ${borrower.name}`,
        asOf,
        definition:
          "Pending balance here means outstanding balance: principal + interest expected − received. Overdue is shown separately.",
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
              label: "Interest expected",
              display: moneyFact(
                ctx,
                row.ledger.interestExpectedC,
                "Interest expected",
                loanSource(row.loan),
              ).display,
              valueC: row.ledger.interestExpectedC,
              source: loanSource(row.loan),
            },
            {
              label: "Received",
              display: `−${moneyFact(ctx, row.ledger.receivedC, "Received", loanSource(row.loan)).display}`,
              valueC: -row.ledger.receivedC,
              source: loanSource(row.loan),
            },
          ],
          subtotalDisplay: moneyFact(
            ctx,
            row.ledger.balanceC,
            "Balance",
            loanSource(row.loan),
          ).display,
          subtotalC: row.ledger.balanceC,
        })),
        totalDisplay: balance.display,
        totalC: totals.balanceC,
        caveats: [
          `As of ${readableDate(asOf)}.`,
          ...(totals.balanceC < 0
            ? [
                `Overpaid by ${moneyFact(ctx, Math.abs(totals.balanceC), "Overpayment").display}.`,
              ]
            : []),
        ],
      },
      sources: [
        {
          type: "borrower",
          id: borrower.id,
          label: borrower.name,
          href: borrowerHref(borrower.id),
        },
        ...rows.slice(0, 4).map((row) => loanSource(row.loan)),
      ],
      notes: [
        `${rows.length} loan(s). Interest expected ${interest.display}; received ${received.display}.`,
        `Overdue ${overdue.display}. Next due ${nextKey ? readableDate(nextKey) : "none"}.`,
      ],
      asOf,
      summary: `${borrower.name} owes ${balance.display} across ${rows.length} loans`,
    };
  },
});
