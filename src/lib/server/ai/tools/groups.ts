import { z } from "zod";
import { sumLedgers } from "$lib/money/ledger";
import { defineTool, ToolError } from "../agent/registry";
import type { ToolContext } from "../agent/context";
import { countFact, groupHref, loanSource, moneyFact } from "./shared";

export const listGroupsTool = defineTool({
  name: "list_groups",
  description:
    "Loan groups the viewer belongs to, with loan counts. Use when the user asks about a group or shared loan set.",
  capability: "read",
  args: z.object({}).strict(),
  label: () => "Listing groups",
  async run(_args, ctx: ToolContext) {
    const groups = await ctx.viewer.groups();
    countFact(ctx, groups.length, "Groups");
    return {
      rows: groups.map((group) => ({
        id: group.id,
        href: groupHref(group.id),
        cells: {
          group: group.name,
          loans: group.loanIds.length,
          role: group.createdByViewer ? "Creator" : "Member",
        },
      })),
      columns: [
        { key: "group", label: "Group" },
        { key: "loans", label: "Loans", align: "right" },
        { key: "role", label: "Role" },
      ],
      notes:
        groups.length === 0
          ? ["No groups visible."]
          : [`${groups.length} group(s).`],
      asOf: ctx.today,
      summary: `${groups.length} groups`,
    };
  },
});

export const getGroupSummaryTool = defineTool({
  name: "get_group_summary",
  description:
    "One group's loans and ledger totals through the viewer's group projection. Use after list_groups.",
  capability: "read",
  args: z.object({ groupId: z.number().int().positive() }).strict(),
  label: (args) => `Opening group #${args.groupId}`,
  async run(args, ctx: ToolContext) {
    const group = await ctx.viewer.groupById(args.groupId);
    if (!group) {
      throw new ToolError(
        "forbidden",
        "That group is not visible to this user.",
      );
    }
    const loans = await ctx.viewer.groupLoansFor(group.id);
    const ledgers = loans.map((loan) => ({
      loan,
      ledger: ctx.viewer.ledger(loan),
    }));
    const totals = sumLedgers(ledgers.map((row) => row.ledger));
    const principal = moneyFact(ctx, totals.principalC, "Group principal");
    const balance = moneyFact(ctx, totals.balanceC, "Group balance");
    const overdue = moneyFact(ctx, totals.overdueC, "Group overdue");
    countFact(ctx, loans.length, "Group loans");

    return {
      rows: ledgers.map((row) => ({
        id: row.loan.id,
        href: `/loans/${row.loan.id}`,
        cells: {
          loan: row.loan.loanName,
          status: row.ledger.status,
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
        { key: "principal", label: "Principal", align: "right" },
        { key: "balance", label: "Balance", align: "right" },
        { key: "overdue", label: "Overdue", align: "right" },
      ],
      calc: {
        title: `Group totals: ${group.name}`,
        asOf: ctx.today,
        definition:
          "Totals sum the same loan ledgers the app shows in the group view.",
        groups: [
          {
            label: "All group loans",
            lines: [
              {
                label: "Principal",
                display: principal.display,
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
            subtotalDisplay: balance.display,
            subtotalC: totals.balanceC,
          },
        ],
        totalDisplay: balance.display,
        totalC: totals.balanceC,
      },
      sources: [
        {
          type: "group",
          id: group.id,
          label: group.name,
          href: groupHref(group.id),
        },
        ...ledgers.slice(0, 4).map((row) => loanSource(row.loan)),
      ],
      notes: [`${loans.length} loan(s) in this group.`],
      asOf: ctx.today,
      summary: `${group.name}: balance ${balance.display}`,
    };
  },
});
