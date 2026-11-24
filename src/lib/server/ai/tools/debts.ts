import { z } from "zod";
import { toDateKey } from "$lib/dates/business-date";
import { calculateDebtSummary, getIntervalLabel } from "$lib/debt-calculations";
import { toCentavos } from "$lib/money/centavos";
import type { DebtInterestInterval } from "$lib/types";
import { defineTool, ToolError } from "../agent/registry";
import type { ToolContext } from "../agent/context";
import { countFact, debtHref, moneyFact, readableDate } from "./shared";

export const listDebtsTool = defineTool({
  name: "list_debts",
  description:
    "Bank / external loans the viewer owns or funds: principal, rate, interval, term, and computed total repayment. Use for 'what do I owe the bank'.",
  capability: "read",
  args: z
    .object({
      limit: z.number().int().min(1).max(100).default(50),
    })
    .strict(),
  label: () => "Listing bank loans",
  async run(args, ctx: ToolContext) {
    const debts = await ctx.viewer.debts();
    const totalPrincipal = debts.reduce(
      (sum, debt) => sum + toCentavos(debt.amount),
      0,
    );
    const principal = moneyFact(ctx, totalPrincipal, "Bank loan principal");
    countFact(ctx, debts.length, "Bank loans");

    return {
      rows: debts.slice(0, args.limit).map((debt) => {
        const summary = calculateDebtSummary({
          principal: debt.amount,
          interestRate: debt.interestRate,
          interestInterval: debt.interestInterval as DebtInterestInterval,
          debtDate: debt.date,
          additionalFees: debt.additionalFees ?? [],
          durationMonths: debt.durationMonths,
        });
        return {
          id: debt.id,
          href: debtHref(debt.id),
          cells: {
            name: debt.name,
            lender: debt.investor?.name ?? "—",
            principal: moneyFact(ctx, toCentavos(debt.amount), "Principal")
              .display,
            rate: `${debt.interestRate}%`,
            interval: getIntervalLabel(
              debt.interestInterval as DebtInterestInterval,
            ),
            total: moneyFact(
              ctx,
              toCentavos(summary.totalRepayment),
              "Total repayment",
            ).display,
            date: readableDate(toDateKey(debt.date)),
          },
        };
      }),
      columns: [
        { key: "name", label: "Bank loan" },
        { key: "lender", label: "Lender" },
        { key: "principal", label: "Principal", align: "right" },
        { key: "rate", label: "Rate", align: "right" },
        { key: "interval", label: "Interval" },
        { key: "total", label: "Total", align: "right" },
        { key: "date", label: "Started" },
      ],
      sources: debts.slice(0, 6).map((debt) => ({
        type: "debt" as const,
        id: debt.id,
        label: debt.name,
        href: debtHref(debt.id),
      })),
      notes:
        debts.length === 0
          ? ["No bank loans visible."]
          : [`${debts.length} bank loan(s).`],
      truncated: debts.length > args.limit,
      asOf: ctx.today,
      summary: `${debts.length} bank loans totaling ${principal.display} principal`,
    };
  },
});

export const getDebtTool = defineTool({
  name: "get_debt",
  description:
    "One bank / external loan with its rate, interval, term, per-period installment, and total repayment. Use after list_debts picks one.",
  capability: "read",
  args: z.object({ debtId: z.number().int().positive() }).strict(),
  label: (args) => `Opening bank loan #${args.debtId}`,
  async run(args, ctx: ToolContext) {
    const debts = await ctx.viewer.debts();
    const debt = debts.find((row) => row.id === args.debtId);
    if (!debt) {
      throw new ToolError(
        "forbidden",
        "That bank loan is not visible to this user.",
      );
    }
    const summary = calculateDebtSummary({
      principal: debt.amount,
      interestRate: debt.interestRate,
      interestInterval: debt.interestInterval as DebtInterestInterval,
      debtDate: debt.date,
      additionalFees: debt.additionalFees ?? [],
      durationMonths: debt.durationMonths,
    });
    const source = {
      type: "debt" as const,
      id: debt.id,
      label: debt.name,
      href: debtHref(debt.id),
    };
    const principal = moneyFact(
      ctx,
      toCentavos(debt.amount),
      "Principal",
      source,
    );
    moneyFact(
      ctx,
      toCentavos(summary.scheduleInterestTotal),
      "Scheduled interest",
      source,
    );
    moneyFact(ctx, toCentavos(summary.additionalFeesTotal), "Fees", source);
    const total = moneyFact(
      ctx,
      toCentavos(summary.totalRepayment),
      "Total repayment",
      source,
    );
    moneyFact(ctx, toCentavos(summary.perPeriodDue), "Per period", source);

    return {
      rows: summary.schedule.slice(0, 24).map((entry, index) => ({
        id: index + 1,
        cells: {
          period: index + 1,
          due: readableDate(toDateKey(entry.date)),
          interest: moneyFact(
            ctx,
            toCentavos(entry.interest),
            "Interest",
            source,
          ).display,
          principal: moneyFact(
            ctx,
            toCentavos(entry.principalPortion),
            "Principal",
            source,
          ).display,
          total: moneyFact(
            ctx,
            toCentavos(entry.periodDue),
            "Period due",
            source,
          ).display,
        },
      })),
      columns: [
        { key: "period", label: "#", align: "right" },
        { key: "due", label: "Due" },
        { key: "interest", label: "Interest", align: "right" },
        { key: "principal", label: "Principal", align: "right" },
        { key: "total", label: "Total", align: "right" },
      ],
      calc: {
        title: `Bank loan: ${debt.name}`,
        asOf: ctx.today,
        definition:
          "Total repayment = principal + scheduled interest + additional fees. The schedule is generated by the existing debt calculator.",
        groups: [
          {
            label: "Full term",
            lines: [
              {
                label: "Principal",
                display: principal.display,
                valueC: toCentavos(debt.amount),
                source,
              },
              {
                label: "Interest",
                display: moneyFact(
                  ctx,
                  toCentavos(summary.scheduleInterestTotal),
                  "Interest",
                  source,
                ).display,
                valueC: toCentavos(summary.scheduleInterestTotal),
                source,
              },
              {
                label: "Fees",
                display: moneyFact(
                  ctx,
                  toCentavos(summary.additionalFeesTotal),
                  "Fees",
                  source,
                ).display,
                valueC: toCentavos(summary.additionalFeesTotal),
                source,
              },
            ],
            subtotalDisplay: total.display,
            subtotalC: toCentavos(summary.totalRepayment),
          },
        ],
        totalDisplay: total.display,
        totalC: toCentavos(summary.totalRepayment),
      },
      sources: [source],
      notes: [
        `${getIntervalLabel(debt.interestInterval as DebtInterestInterval)} at ${debt.interestRate}%.`,
        debt.durationMonths ? `${debt.durationMonths} month term.` : "",
      ].filter(Boolean),
      asOf: ctx.today,
      summary: `${debt.name}: ${total.display} total repayment`,
    };
  },
});
