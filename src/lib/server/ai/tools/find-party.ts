import { z } from "zod";
import { defineTool, ToolError } from "../agent/registry";
import type { ToolContext } from "../agent/context";
import { borrowerHref, countFact, investorHref, plural } from "./shared";

const ROLE = z.enum(["borrower", "investor", "witness"]).optional();

function normalize(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function score(query: string, name: string): number {
  const target = normalize(name);
  if (!target) return 0;
  if (target === query) return 100;
  if (target.startsWith(query)) return 80;
  const words = target.split(" ");
  if (words.some((word) => word === query)) return 70;
  if (words.some((word) => word.startsWith(query))) return 60;
  if (target.includes(query)) return 40;
  return 0;
}

function editDistance(left: string, right: string): number {
  const a = left.slice(0, 80);
  const b = right.slice(0, 80);
  const row = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i += 1) {
    let previous = row[0];
    row[0] = i;
    for (let j = 1; j <= b.length; j += 1) {
      const temp = row[j];
      row[j] = Math.min(
        row[j] + 1,
        row[j - 1] + 1,
        previous + (a[i - 1] === b[j - 1] ? 0 : 1),
      );
      previous = temp;
    }
  }
  return row[b.length];
}

function hrefFor(
  type: "borrower" | "investor" | "witness",
  id: number,
): string {
  if (type === "borrower") return borrowerHref(id);
  if (type === "investor") return investorHref(id);
  return "/witnesses";
}

function labelFor(type: string, count: number, name: string): string {
  const noun =
    type === "borrower"
      ? plural(count, "loan")
      : type === "investor"
        ? plural(count, "funded loan")
        : plural(count, "witnessed loan");
  return `${name}: ${count} ${noun}`;
}

export const findPartyTool = defineTool({
  name: "find_party",
  description:
    "Find a borrower, investor, or witness by name inside what this user can already see. Returns candidates with stable ids. Never guess between two strong matches; ask the user to pick.",
  capability: "read",
  args: z
    .object({
      query: z.string().min(1).max(80),
      role: ROLE,
    })
    .strict(),
  label: (args) => `Finding “${args.query}”`,
  async run(args, ctx: ToolContext) {
    const query = normalize(args.query);
    if (!query) {
      throw new ToolError("bad_args", "Name is empty", "Ask for a name.");
    }
    const candidates = (await ctx.viewer.partyCandidates()).filter(
      (row) => !args.role || row.type === args.role,
    );
    const scored = candidates
      .map((row) => ({ row, score: score(query, row.name) }))
      .filter((item) => item.score > 0)
      .sort(
        (a, b) => b.score - a.score || a.row.name.localeCompare(b.row.name),
      );

    if (scored.length === 0) {
      const nearest = candidates
        .map((row) => ({
          row,
          distance: editDistance(query, normalize(row.name)),
        }))
        .sort((a, b) => a.distance - b.distance)
        .slice(0, 3)
        .filter(
          (item) => item.distance <= Math.max(3, Math.ceil(query.length / 3)),
        )
        .map((item) => item.row.name);
      if (nearest.length === 0) {
        return {
          notes: ["No matching borrower, investor, or witness."],
          summary: "No match",
        };
      }
      throw new ToolError(
        "not_found",
        "No exact match.",
        `Closest names: ${nearest.join(", ")}. Ask which one, or do not search for a substitute.`,
      );
    }

    const best = scored[0].score;
    const strong = scored.filter(
      (item) => item.score >= Math.max(60, best - 10),
    );
    const rows = strong.slice(0, 5).map(({ row }) => ({
      id: `${row.type}-${row.id}`,
      href: hrefFor(row.type, row.id),
      cells: {
        name: row.name,
        role: row.type,
        loans: row.loanCount,
        summary: labelFor(row.type, row.loanCount, row.name),
      },
    }));
    countFact(ctx, rows.length, "Matches");
    return {
      rows,
      columns: [
        { key: "name", label: "Name" },
        { key: "role", label: "Role" },
        { key: "loans", label: "Loans", align: "right" },
      ],
      sources: strong.slice(0, 5).map(({ row }) => ({
        type: row.type,
        id: row.id,
        label: row.name,
        href: hrefFor(row.type, row.id),
      })),
      notes:
        strong.length > 1
          ? [
              `Ambiguous: ${strong.length} strong matches. Ask the user which one before answering.`,
            ]
          : [`Found ${strong[0].row.name} (${strong[0].row.type}).`],
      summary: `${strong.length} ${plural(strong.length, "match", "matches")}`,
    };
  },
});
