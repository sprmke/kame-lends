import { z } from "zod";
import { HELP_ENTRIES } from "$lib/assistant/help-content";
import { defineTool } from "../agent/registry";
import type { ToolContext } from "../agent/context";
import { countFact } from "./shared";

function tokens(value: string): string[] {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((word) => word.length > 2);
}

export const searchHelpTool = defineTool({
  name: "search_help",
  description:
    "Search short app help snippets and return the page where the user can do the task. Use for 'how do I add a payment' or 'where do I set a commission'.",
  capability: "read",
  args: z.object({ query: z.string().min(2).max(120) }).strict(),
  label: (args) => `Searching help for “${args.query}”`,
  async run(args, ctx: ToolContext) {
    const query = tokens(args.query);
    const scored = HELP_ENTRIES.map((entry) => {
      const haystack = tokens(
        `${entry.title} ${entry.text} ${entry.keywords.join(" ")}`,
      );
      let score = 0;
      for (const word of query) {
        if (entry.title.toLowerCase().includes(word)) score += 6;
        if (entry.keywords.some((keyword) => keyword.startsWith(word)))
          score += 4;
        if (haystack.includes(word)) score += 1;
      }
      return { entry, score };
    })
      .filter((item) => item.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 4);

    const results =
      scored.length > 0
        ? scored
        : HELP_ENTRIES.slice(0, 3).map((entry) => ({ entry, score: 0 }));
    countFact(ctx, results.length, "Help results");
    return {
      rows: results.map(({ entry }) => ({
        id: entry.id,
        href: entry.href,
        cells: {
          title: entry.title,
          text: entry.text,
          href: entry.href,
        },
      })),
      columns: [
        { key: "title", label: "Help" },
        { key: "text", label: "What to do" },
      ],
      sources: results.map(({ entry }) => ({
        type: "help" as const,
        id: entry.id,
        label: entry.title,
        href: entry.href,
      })),
      notes: [
        "Help answers come from the app's own guides; no user data is involved.",
      ],
      asOf: ctx.today,
      summary: `${results.length} help result(s)`,
    };
  },
});
