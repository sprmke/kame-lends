/**
 * Facts and number tokens (ADR-3).
 *
 * Tools register computed values here. The model writes `{{f12}}`; the server
 * substitutes the display string. No number typed by the model can survive the
 * verifier unless it is a list marker, a year inside a tool-backed date, or an
 * entity id that a tool actually returned.
 */
import { formatPHP } from "$lib/money/centavos";
import type { Fact, FactKind, SourceRef } from "$lib/assistant/types";

export interface FactInput {
  kind: FactKind;
  value: number | string | null;
  display?: string;
  label?: string;
  source?: SourceRef;
}

const TOKEN = /\{\{(f\d+)\}\}/g;

export class FactStore {
  private readonly byId = new Map<string, Fact>();
  private sequence = 0;

  add(input: FactInput): Fact {
    this.sequence += 1;
    const id = `f${this.sequence}`;
    const fact: Fact = {
      id,
      kind: input.kind,
      value: input.value,
      display:
        input.display ?? defaultDisplay(input.kind, input.value, input.label),
      label: input.label,
      source: input.source,
    };
    this.byId.set(id, fact);
    return fact;
  }

  addMoney(centavos: number, label?: string, source?: SourceRef): Fact {
    return this.add({ kind: "money", value: centavos, label, source });
  }

  addCount(value: number, label?: string, source?: SourceRef): Fact {
    return this.add({ kind: "count", value, label, source });
  }

  addPercent(value: number, label?: string, source?: SourceRef): Fact {
    return this.add({
      kind: "percent",
      value,
      display: `${trimNumber(value)}%`,
      label,
      source,
    });
  }

  addDate(value: string, label?: string, source?: SourceRef): Fact {
    return this.add({ kind: "date", value, label, source });
  }

  addText(value: string, label?: string, source?: SourceRef): Fact {
    return this.add({ kind: "text", value, label, source });
  }

  get(id: string): Fact | undefined {
    return this.byId.get(id);
  }

  all(): Fact[] {
    return [...this.byId.values()];
  }

  /** Entity ids returned by tools; the verifier allows `#12` for these. */
  allowedIds(): Set<string> {
    const ids = new Set<string>();
    for (const fact of this.byId.values()) {
      if (fact.source) ids.add(String(fact.source.id));
    }
    return ids;
  }
}

function trimNumber(value: number): string {
  return Number.isInteger(value)
    ? String(value)
    : value.toFixed(2).replace(/\.?0+$/, "");
}

function defaultDisplay(
  kind: FactKind,
  value: number | string | null,
  label?: string,
): string {
  if (value === null) return "—";
  if (kind === "money") return formatPHP(Number(value));
  if (kind === "percent") return `${trimNumber(Number(value))}%`;
  if (kind === "date") return String(value);
  if (kind === "count") return Number(value).toLocaleString("en-PH");
  return label ? String(value) : String(value);
}

/**
 * Replaces complete tokens in a text delta while holding a partial token at
 * the end. Order matters: the resolver is fed every delta in sequence.
 */
export class TokenStreamResolver {
  private buffer = "";
  private readonly unknown = new Set<string>();

  constructor(private readonly facts: FactStore) {}

  feed(delta: string): string {
    this.buffer += delta;
    let output = "";
    let cursor = 0;

    while (true) {
      const open = this.buffer.indexOf("{{", cursor);
      if (open < 0) break;
      const close = this.buffer.indexOf("}}", open + 2);
      if (close < 0) break;
      output += this.buffer.slice(cursor, open);
      const token = this.buffer.slice(open + 2, close);
      output += this.resolveToken(token);
      cursor = close + 2;
    }

    const rest = this.buffer.slice(cursor);
    const partial = rest.indexOf("{{");
    if (partial >= 0) {
      output += rest.slice(0, partial);
      this.buffer = rest.slice(partial);
    } else {
      // A lone trailing "{" may be the first half of a token split by the network.
      if (rest.endsWith("{")) {
        output += rest.slice(0, -1);
        this.buffer = "{";
      } else {
        output += rest;
        this.buffer = "";
      }
    }
    return output;
  }

  flush(): string {
    const leftover = this.buffer;
    this.buffer = "";
    return leftover.replace(TOKEN, (match) =>
      this.resolveToken(match.slice(2, -2)),
    );
  }

  violations(): string[] {
    return [...this.unknown];
  }

  private resolveToken(id: string): string {
    const fact = this.facts.get(id);
    if (!fact) {
      this.unknown.add(id);
      return "";
    }
    return fact.display;
  }
}

export function resolveTokens(
  text: string,
  facts: FactStore,
): {
  text: string;
  unknown: string[];
} {
  const unknown: string[] = [];
  const resolved = text.replace(TOKEN, (match, id: string) => {
    const fact = facts.get(id);
    if (!fact) {
      unknown.push(id);
      return "";
    }
    return fact.display;
  });
  return { text: resolved, unknown };
}

/**
 * Numbers the model wrote itself. Returns human-readable snippets for the
 * regenerate instruction, or an empty array when every digit is accounted for.
 */
export function findUnverifiedNumbers(
  text: string,
  allowedIds: Set<string> = new Set(),
): string[] {
  const withoutTokens = text.replace(TOKEN, " ");
  const withoutLinks = withoutTokens
    .replace(/\]\([^)]*\)/g, "]") // markdown link targets
    .replace(/https?:\/\/\S+/g, " ");
  const findings: string[] = [];

  const lines = withoutLinks.split("\n");
  for (const rawLine of lines) {
    let line = rawLine;
    // List numbering is presentation, not data.
    line = line.replace(/^\s*\d+[.)]\s+/, " ");
    // Headings like "### 1. Balance" carry the same presentation number.
    line = line.replace(/^(#{1,6}\s*)\d+[.)]\s+/, "$1");
    // Ordinals (1st, 2nd, 23rd) are not amounts.
    line = line.replace(/\b\d+(st|nd|rd|th)\b/gi, " ");
    // Entity ids that a tool actually returned.
    line = line.replace(/#(\d+)\b/g, (match, id: string) =>
      allowedIds.has(id) ? " " : match,
    );

    const match = /\d[\d,]*(?:\.\d+)?%?/.exec(line);
    if (match) {
      const start = Math.max(0, (match.index ?? 0) - 24);
      const snippet = rawLine.slice(start, start + 64).trim();
      findings.push(snippet);
    }
  }
  return [...new Set(findings)];
}

/** Cheap heuristic used only for logging direct prompt-injection attempts. */
export function looksLikeInjection(text: string): boolean {
  return /(ignore (all )?(previous|prior|above) (instructions|rules)|system prompt|reveal your (prompt|instructions)|disregard (the )?(rules|instructions)|jailbreak|developer mode|you are now)/i.test(
    text,
  );
}
