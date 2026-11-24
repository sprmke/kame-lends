import { z } from "zod";
import { defineTool, ToolError } from "../agent/registry";
import type { ToolContext } from "../agent/context";
import { countFact } from "./shared";

export const getDataHealthTool = defineTool({
  name: "get_data_health",
  description:
    "Workspace data-health checks: counts by check, no row details, no names. Owner only. Use for 'is anything wrong with my data'.",
  capability: "read",
  args: z.object({}).strict(),
  label: () => "Running data-health checks",
  async run(_args, ctx: ToolContext) {
    const loans = await ctx.viewer.allLoans();
    const isOwner =
      ctx.role === "admin" || loans.some((loan) => loan.userId === ctx.userId);
    if (!isOwner) {
      throw new ToolError(
        "forbidden",
        "Data health is available to the workspace owner only.",
        "Do not attempt another path. Offer a portfolio question instead.",
      );
    }
    const { runMoneyHealthChecks } = await import("$lib/server/money-health");
    const checks = await runMoneyHealthChecks();
    const open = checks.filter((check) => check.count > 0);
    const total = open.reduce((sum, check) => sum + check.count, 0);
    countFact(ctx, total, "Open data issues");
    return {
      rows: checks.map((check) => ({
        id: check.id,
        cells: {
          check: check.title,
          issues: check.count,
          status: check.count > 0 ? "Needs attention" : "Clear",
        },
      })),
      columns: [
        { key: "check", label: "Check" },
        { key: "issues", label: "Issues", align: "right" },
        { key: "status", label: "Status" },
      ],
      notes: [
        `${open.length} of ${checks.length} checks have issues. Counts only; no records are changed.`,
      ],
      asOf: ctx.today,
      summary:
        total === 0
          ? "No open data issues found"
          : `${total} open data issue(s) across ${open.length} checks`,
    };
  },
});
