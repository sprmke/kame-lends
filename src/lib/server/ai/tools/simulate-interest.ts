import { z } from "zod";
import { fromCentavos, toCentavos } from "$lib/money/centavos";
import { buildLoanLedger, investorLedger } from "$lib/money/ledger";
import { defineTool, ToolError } from "../agent/registry";
import type { ToolContext } from "../agent/context";
import {
  dateKey,
  dateFact,
  loanSource,
  moneyFact,
  readableDate,
} from "./shared";

const periodInput = z
  .object({
    dueDate: dateKey,
    interestRate: z.number().min(0).max(1_000),
    interestType: z.enum(["rate", "fixed"]).default("rate"),
  })
  .strict();

export const simulateInterestTool = defineTool({
  name: "simulate_interest",
  description:
    "What-if interest simulation using the same ledger engine. Read-only; nothing is saved. Use for 'what if the rate were 3%' or 'interest if paid on Dec 15'. Label the answer as a simulation.",
  capability: "read",
  args: z
    .object({
      loanId: z.number().int().positive().optional(),
      principal: z.number().positive().max(1_000_000_000).optional(),
      interestRate: z.number().min(0).max(1_000).optional(),
      interestType: z.enum(["rate", "fixed"]).optional(),
      dueDate: dateKey.optional(),
      periods: z.array(periodInput).max(24).optional(),
    })
    .strict(),
  label: () => "Running a simulation",
  async run(args, ctx: ToolContext) {
    if (!args.loanId && (!args.principal || !args.dueDate)) {
      throw new ToolError(
        "bad_args",
        "A simulation needs a loanId, or a principal and a due date.",
        "Ask the user which loan, or the amount and due date.",
      );
    }
    const loan = args.loanId ? await ctx.viewer.loanById(args.loanId) : null;
    if (args.loanId && !loan) {
      throw new ToolError(
        "forbidden",
        "That loan is not visible to this user.",
      );
    }
    const inferredType =
      args.interestType ??
      (loan?.loanInvestors[0]?.interestType === "fixed" ? "fixed" : "rate");
    const baseRate =
      args.interestRate ??
      (loan ? Number(loan.loanInvestors[0]?.interestRate ?? 0) : 0);
    const principalC = loan
      ? ctx.viewer.ledger(loan).principalC
      : toCentavos(args.principal ?? 0);
    if (principalC <= 0) {
      throw new ToolError("bad_args", "Principal must be greater than zero.");
    }
    const dueDate = args.dueDate ?? (loan ? ctx.viewer.today : "");
    if (!dueDate) {
      throw new ToolError("bad_args", "A due date is required.");
    }

    const periods = args.periods?.map((period) => ({
      dueDate: period.dueDate,
      interestRate: String(period.interestRate),
      interestType: period.interestType,
    }));

    const ledger = buildLoanLedger(
      {
        dueDate,
        loanInvestors: [
          {
            id: 0,
            investorId: 0,
            investor: { id: 0, name: "Simulation" },
            amount: fromCentavos(principalC),
            interestRate: String(baseRate),
            interestType: inferredType,
            sentDate: ctx.today,
            isPaid: true,
            hasMultipleInterest: Boolean(periods?.length),
            interestPeriods: periods,
            receivedPayments: [],
          },
        ],
      },
      { today: ctx.today },
    );
    const position = investorLedger(ledger, 0);
    if (!position) {
      throw new ToolError("no_data", "The simulation produced no result.");
    }

    const interest = moneyFact(
      ctx,
      position.interestExpectedC,
      "Simulated interest",
    );
    const total = moneyFact(ctx, position.dueC, "Simulated total due");
    moneyFact(ctx, principalC, "Simulated principal");
    dateFact(ctx, dueDate, "Simulated due date");

    return {
      columns: [
        { key: "label", label: "Item" },
        { key: "value", label: "Value", align: "right" },
      ],
      rows: [
        {
          id: "principal",
          cells: {
            label: "Principal",
            value: moneyFact(ctx, principalC, "Principal").display,
          },
        },
        {
          id: "rate",
          cells: { label: "Rate", value: `${baseRate}%` },
        },
        {
          id: "interest",
          cells: { label: "Interest", value: interest.display },
        },
        {
          id: "total",
          cells: { label: "Total due", value: total.display },
        },
      ],
      calc: {
        title: "Simulation",
        asOf: ctx.today,
        definition:
          "Uses the same engine as real loans: fixed interest is a peso amount; rate interest rounds once per period.",
        groups: [
          {
            label: loan ? `Based on ${loan.loanName}` : "Hypothetical loan",
            lines: [
              {
                label: "Principal",
                display: moneyFact(ctx, principalC, "Principal").display,
                valueC: principalC,
              },
              {
                label: `Interest at ${baseRate}%`,
                display: interest.display,
                valueC: position.interestExpectedC,
              },
            ],
            subtotalDisplay: total.display,
            subtotalC: position.dueC,
          },
        ],
        totalDisplay: total.display,
        totalC: position.dueC,
        caveats: [
          `Simulation only, as of ${readableDate(ctx.today)}. Nothing is saved.`,
        ],
      },
      sources: loan ? [loanSource(loan)] : [],
      notes: ["Simulation only. Nothing is saved."],
      asOf: ctx.today,
      summary: `Simulated interest ${interest.display}, total ${total.display}`,
    };
  },
});
