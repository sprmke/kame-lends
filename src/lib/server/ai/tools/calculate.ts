import { z } from "zod";
import { addC, mulRate, rateOf, subC } from "$lib/money/centavos";
import { defineTool, ToolError } from "../agent/registry";
import type { ToolContext } from "../agent/context";
import { moneyFact } from "./shared";

const OP = z.enum(["add", "subtract", "difference", "percentOf", "applyRate"]);

function labelOf(ctx: ToolContext, id: string): string {
  return ctx.facts.get(id)?.label ?? id;
}

export const calculateTool = defineTool({
  name: "calculate",
  description:
    "Combine numbers that tools already returned. The only way to add, subtract, take a percentage, or apply a rate. Pass fact ids, never typed amounts.",
  capability: "read",
  args: z
    .object({
      op: OP,
      factIds: z
        .array(z.string().regex(/^f\d+$/))
        .min(2)
        .max(12),
    })
    .strict(),
  label: () => "Computing",
  async run(args, ctx: ToolContext) {
    const facts = args.factIds.map((id) => {
      const fact = ctx.facts.get(id);
      if (!fact) {
        throw new ToolError(
          "bad_args",
          `Unknown fact ${id}.`,
          "Use an id a tool returned.",
        );
      }
      return fact;
    });

    const numbers = facts.map((fact) => Number(fact.value ?? 0));
    const allMoney = facts.every((fact) => fact.kind === "money");
    const allCount = facts.every((fact) => fact.kind === "count");

    if (
      args.op === "add" ||
      args.op === "subtract" ||
      args.op === "difference"
    ) {
      if (!allMoney && !allCount) {
        throw new ToolError(
          "bad_args",
          "Add and subtract need amounts or counts, not a mix.",
        );
      }
      const total =
        args.op === "subtract"
          ? subC(numbers[0], addC(...numbers.slice(1)))
          : args.op === "difference"
            ? Math.abs(subC(numbers[0], numbers[1]))
            : addC(...numbers);
      const fact = allMoney
        ? moneyFact(ctx, total, "Computed total")
        : ctx.facts.addCount(total, "Computed total");
      return {
        calc: {
          title: "Computed total",
          asOf: ctx.today,
          definition:
            args.op === "difference"
              ? "Absolute difference between two tool values."
              : "Sum of tool values using integer centavo math.",
          groups: [
            {
              label: "Inputs",
              lines: facts.map((item) => ({
                label: item.label ?? item.id,
                display:
                  args.op === "subtract" && item !== facts[0]
                    ? `−${item.display}`
                    : item.display,
                valueC: item.kind === "money" ? Number(item.value) : undefined,
              })),
              subtotalDisplay: fact.display,
              subtotalC: allMoney ? total : undefined,
            },
          ],
          totalDisplay: fact.display,
          totalC: allMoney ? total : undefined,
        },
        notes: [`${args.op}: ${fact.display}`],
        asOf: ctx.today,
        summary: fact.display,
      };
    }

    if (args.op === "percentOf") {
      if (!allMoney) {
        throw new ToolError("bad_args", "Percent of needs two amounts.");
      }
      const percent = rateOf(numbers[0], numbers[1]);
      const fact = ctx.facts.addPercent(percent, "Computed percentage");
      return {
        calc: {
          title: "Percentage",
          asOf: ctx.today,
          definition: "part ÷ whole × 100.",
          groups: [
            {
              label: "Inputs",
              lines: facts.map((item) => ({
                label: item.label ?? item.id,
                display: item.display,
                valueC: Number(item.value),
              })),
              subtotalDisplay: fact.display,
            },
          ],
          totalDisplay: fact.display,
        },
        notes: [
          `${labelOf(ctx, args.factIds[0])} is ${fact.display} of ${labelOf(ctx, args.factIds[1])}.`,
        ],
        asOf: ctx.today,
        summary: fact.display,
      };
    }

    // applyRate: money × percent
    const money = facts.find((fact) => fact.kind === "money");
    const percent = facts.find((fact) => fact.kind === "percent");
    if (!money || !percent) {
      throw new ToolError(
        "bad_args",
        "Applying a rate needs one amount and one percentage.",
      );
    }
    const resultC = mulRate(
      Number(money.value ?? 0),
      Number(percent.value ?? 0),
    );
    const fact = moneyFact(ctx, resultC, "Computed amount");
    return {
      calc: {
        title: "Rate applied",
        asOf: ctx.today,
        definition: "amount × rate ÷ 100, rounded half-up to the centavo.",
        groups: [
          {
            label: "Inputs",
            lines: [
              {
                label: money.label ?? money.id,
                display: money.display,
                valueC: Number(money.value),
              },
              { label: percent.label ?? percent.id, display: percent.display },
            ],
            subtotalDisplay: fact.display,
            subtotalC: resultC,
          },
        ],
        totalDisplay: fact.display,
        totalC: resultC,
      },
      notes: [`${percent.display} of ${money.display} is ${fact.display}.`],
      asOf: ctx.today,
      summary: fact.display,
    };
  },
});
