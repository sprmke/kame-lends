import { z } from "zod";
import { defineTool, ToolError } from "../agent/registry";
import type { ToolContext } from "../agent/context";
import {
  borrowerHref,
  debtHref,
  groupHref,
  investorHref,
  loanHref,
} from "./shared";

const TARGET = z.enum([
  "dashboard",
  "assistant",
  "loans",
  "loan",
  "borrower",
  "investor",
  "witness",
  "debt",
  "group",
  "payments",
  "settings",
  "new_loan",
]);

function staticHref(target: z.infer<typeof TARGET>): string | null {
  switch (target) {
    case "dashboard":
      return "/dashboard";
    case "assistant":
      return "/assistant";
    case "loans":
      return "/loans";
    case "payments":
      return "/loans";
    case "settings":
      return "/settings";
    case "new_loan":
      return "/loans/new";
    default:
      return null;
  }
}

export const openPageTool = defineTool({
  name: "open_page",
  description:
    "Return an allowlisted internal link so the user can act on the answer (open a loan, a party, or the page where they can make the change). Never invent URLs.",
  capability: "read",
  args: z
    .object({
      target: TARGET,
      id: z.number().int().positive().optional(),
    })
    .strict(),
  label: (args) => `Preparing a link to ${args.target.replace("_", " ")}`,
  async run(args, ctx: ToolContext) {
    const access =
      args.id != null ? await import("$lib/server/access-control") : null;
    let href = staticHref(args.target);
    if (!href && args.id == null) {
      throw new ToolError("bad_args", `${args.target} needs an id.`);
    }
    if (!href && args.id != null) {
      if (args.target === "loan") {
        const loan = await ctx.viewer.loanById(args.id);
        if (!loan)
          throw new ToolError("forbidden", "That loan is not visible.");
        href = loanHref(loan.id);
      } else if (args.target === "borrower") {
        const found = (await ctx.viewer.borrowers()).some(
          (row) => row.id === args.id,
        );
        if (!found)
          throw new ToolError("forbidden", "That borrower is not visible.");
        href = borrowerHref(args.id);
      } else if (args.target === "investor") {
        if (
          !(await access!.hasInvestorContactViewAccess(args.id, ctx.userId))
        ) {
          throw new ToolError("forbidden", "That investor is not visible.");
        }
        href = investorHref(args.id);
      } else if (args.target === "witness") {
        if (!(await access!.hasWitnessContactViewAccess(args.id, ctx.userId))) {
          throw new ToolError("forbidden", "That witness is not visible.");
        }
        href = "/witnesses";
      } else if (args.target === "debt") {
        const found = (await ctx.viewer.debts()).some(
          (row) => row.id === args.id,
        );
        if (!found)
          throw new ToolError("forbidden", "That bank loan is not visible.");
        href = debtHref(args.id);
      } else if (args.target === "group") {
        const found = await ctx.viewer.groupById(args.id);
        if (!found)
          throw new ToolError("forbidden", "That group is not visible.");
        href = groupHref(args.id);
      }
    }
    if (!href) throw new ToolError("bad_args", "Unsupported link target.");
    const sourceType =
      args.target === "borrower"
        ? "borrower"
        : args.target === "investor"
          ? "investor"
          : args.target === "witness"
            ? "witness"
            : args.target === "debt"
              ? "debt"
              : args.target === "group"
                ? "group"
                : args.target === "loan"
                  ? "loan"
                  : "help";
    return {
      notes: [`Link: ${href}`],
      sources: [
        {
          type: sourceType,
          id: args.id ?? 0,
          href,
          label: args.target.replace("_", " "),
        },
      ],
      asOf: ctx.today,
      summary: href,
    };
  },
});
