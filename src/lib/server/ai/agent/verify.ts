/**
 * Verifier and deterministic fallback (ADR-3/ADR-4).
 *
 * The model's prose is checked after streaming. Any number it wrote itself is a
 * violation. On a second violation the UI swaps to a fallback built only from
 * tool facts, so a wrong number can never be presented as an answer.
 */
import type {
  AssistantBlock,
  CalcTrace,
  Fact,
  SourceRef,
  StatBlock,
  TableColumn,
  TableRow,
  ToolArtifact,
} from "$lib/assistant/types";
import { findUnverifiedNumbers, resolveTokens, type FactStore } from "./facts";
import { PROMPT_CANARY } from "../prompts/assistant-chat";

export interface VerifyInput {
  text: string;
  facts: FactStore;
  artifacts: ToolArtifact[];
}

export interface VerifyResult {
  ok: boolean;
  text: string;
  violations: string[];
}

const EMAIL = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i;
const PHONE = /(?:\+63|0)9\d{2}[\s-]?\d{3}[\s-]?\d{4}\b/;
const STORAGE_REF = /\bstorage:[a-z0-9/_-]+/i;
const DATA_URL = /data:image\//i;
const HTML_TAG = /<\/?[a-z][^>]*>/i;

export function sanitizeMarkdown(text: string): string {
  return text
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<\/?[a-z][^>]*>/gi, "")
    .replace(/!\[[^\]]*\]\([^)]*\)/g, "")
    .replace(/\[([^\]]+)\]\(([^)]*)\)/g, "$1")
    .replace(/\r\n/g, "\n")
    .trim();
}

function privacyViolations(text: string): string[] {
  const hits: string[] = [];
  if (EMAIL.test(text)) hits.push("email address");
  if (PHONE.test(text)) hits.push("phone number");
  if (STORAGE_REF.test(text)) hits.push("storage reference");
  if (DATA_URL.test(text)) hits.push("inline image data");
  if (HTML_TAG.test(text)) hits.push("raw HTML");
  return hits;
}

export function verifyAnswer(input: VerifyInput): VerifyResult {
  const { text: rawResolved, unknown } = resolveTokens(input.text, input.facts);
  // Our own fencing tags are not model HTML; drop them before the privacy scan
  // so a fenced receipt field cannot look like raw HTML.
  const resolved = rawResolved.replace(/<\/?untrusted_data>/gi, "");
  const violations: string[] = [];
  if (unknown.length > 0) {
    violations.push(`unknown fact token(s): ${unknown.join(", ")}`);
  }
  const numbers = findUnverifiedNumbers(input.text, input.facts.allowedIds());
  for (const snippet of numbers) {
    violations.push(`number not supplied by a tool: "${snippet}"`);
  }
  for (const hit of privacyViolations(resolved)) {
    violations.push(`private data in the answer: ${hit}`);
  }
  if (resolved.includes(PROMPT_CANARY)) {
    violations.push("internal marker leaked");
  }
  return {
    ok: violations.length === 0,
    text: sanitizeMarkdown(resolved),
    violations,
  };
}

/* ------------------------------- blocks ---------------------------------- */

const PRIMARY_MONEY_LABELS = [
  "Outstanding balance",
  "Portfolio principal",
  "Principal",
  "Overdue total",
  "Overdue",
  "Interest collected",
  "Interest expected",
  "Capital out",
  "Total repayment",
  "Your commission",
  "Total scheduled",
  "Total due",
  "Net cashflow",
];

function statFromFact(fact: Fact): StatBlock {
  return {
    label: fact.label ?? "Value",
    value: fact.display,
    tone:
      /overdue/i.test(fact.label ?? "") && Number(fact.value) > 0
        ? "warning"
        : /collected|outstanding/i.test(fact.label ?? "")
          ? "positive"
          : "default",
  };
}

export function buildStats(facts: Fact[]): StatBlock[] {
  const money = facts.filter((fact) => fact.kind === "money");
  const preferred = PRIMARY_MONEY_LABELS.flatMap((label) =>
    money.filter((fact) => fact.label === label),
  );
  const chosen = [
    ...new Map(preferred.map((fact) => [fact.label, fact])).values(),
  ];
  const fallback = money.filter((fact) => !chosen.includes(fact));
  const stats = [...chosen, ...fallback].slice(0, 4).map(statFromFact);
  if (stats.length === 0) {
    const counts = facts.filter((fact) => fact.kind === "count").slice(0, 3);
    return counts.map(statFromFact);
  }
  return stats;
}

function artifactTable(
  artifact: ToolArtifact,
  index: number,
): Extract<AssistantBlock, { type: "data_table" }> | null {
  if (!artifact.rows || !artifact.columns || artifact.rows.length === 0) {
    return null;
  }
  return {
    type: "data_table",
    title: artifact.label,
    columns: artifact.columns.slice(0, 7),
    rows: artifact.rows.slice(0, index === 0 ? 12 : 6),
    note: artifact.truncated
      ? "Showing the first rows. Ask to narrow the list for more."
      : undefined,
    copyable: true,
  };
}

function entityBlock(artifacts: ToolArtifact[]): AssistantBlock | null {
  const loanArtifact = artifacts.find(
    (artifact) => artifact.name === "get_loan",
  );
  if (!loanArtifact || loanArtifact.sources?.length !== 1) return null;
  const source = loanArtifact.sources[0];
  if (source.type !== "loan") return null;
  const columns = loanArtifact.columns ?? [];
  const rows = loanArtifact.rows ?? [];
  return {
    type: "entity_card",
    entityType: "loan",
    id: Number(source.id),
    title: source.label ?? `Loan #${source.id}`,
    href: source.href ?? `/loans/${source.id}`,
    stats: rows.slice(0, 3).map((row) => ({
      label: String(row.cells.investor ?? "Tranche"),
      value: String(row.cells.amount ?? ""),
      hint: columns.find((column) => column.key === "rate")
        ? String(row.cells.rate ?? "")
        : undefined,
    })),
  };
}

export function buildBlocks(
  artifacts: ToolArtifact[],
  facts: Fact[],
): AssistantBlock[] {
  const blocks: AssistantBlock[] = [];
  const stats = buildStats(facts);
  if (stats.length > 0) blocks.push({ type: "stat_list", stats });

  const entity = entityBlock(artifacts);
  if (entity) blocks.push(entity);

  const tables = artifacts
    .map((artifact, index) => artifactTable(artifact, index))
    .filter(
      (table): table is Extract<AssistantBlock, { type: "data_table" }> =>
        table !== null,
    );
  blocks.push(...tables.slice(0, 2));

  const chart = artifacts.find((artifact) => artifact.chart?.length);
  if (chart?.chart) {
    blocks.push({
      type: "chart",
      title: chart.label,
      points: chart.chart,
      note: "Blue is money in; orange is money out.",
    });
  }

  const calc = artifacts
    .map((artifact) => artifact.calc)
    .filter((trace): trace is CalcTrace => Boolean(trace))
    .at(0);
  if (calc) blocks.push({ type: "calc_breakdown", trace: calc });

  const sources = mergeSources(
    artifacts.flatMap((artifact) => artifact.sources ?? []),
  );
  if (sources.length > 0) {
    blocks.push({ type: "source_chips", sources: sources.slice(0, 8) });
  }

  const notes = artifacts.flatMap((artifact) => artifact.notes ?? []);
  const warnings = notes.filter((note) =>
    /unlinked|not linked|manual|override|truncat|showing \d+ of|data issue|simulation/i.test(
      note,
    ),
  );
  for (const text of warnings.slice(0, 2)) {
    blocks.push({ type: "callout", tone: "warn", text });
  }

  const actions = followUps(artifacts, sources);
  if (actions.length > 0) blocks.push({ type: "quick_actions", actions });

  const party = artifacts.find((artifact) => artifact.name === "find_party");
  const ambiguous =
    party &&
    (party.rows?.length ?? 0) > 1 &&
    (party.notes ?? []).some((note) => /ambiguous/i.test(note));
  if (ambiguous && party.sources && party.sources.length > 1) {
    blocks.push({
      type: "choice",
      prompt: "Which one did you mean?",
      options: party.sources.slice(0, 5).map((source) => ({
        label: source.label ?? `${source.type} #${source.id}`,
        hint: source.type,
        value: `Use ${source.type} #${source.id} (${source.label ?? ""}).`,
      })),
    });
  }
  return blocks;
}

function mergeSources(sources: SourceRef[]): SourceRef[] {
  const seen = new Set<string>();
  const result: SourceRef[] = [];
  for (const source of sources) {
    const key = `${source.type}:${source.id}`;
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(source);
  }
  return result;
}

function followUps(
  artifacts: ToolArtifact[],
  sources: SourceRef[],
): Array<{ label: string; message?: string; href?: string }> {
  const names = new Set(artifacts.map((artifact) => artifact.name));
  const actions: Array<{ label: string; message?: string; href?: string }> = [];
  if (names.has("get_borrower_position")) {
    actions.push({
      label: "Payment history",
      message: "Show the payment history for this borrower.",
    });
    const borrower = sources.find((source) => source.type === "borrower");
    if (borrower?.href)
      actions.push({ label: "Open borrower", href: borrower.href });
  } else if (names.has("get_loan")) {
    actions.push({
      label: "Show schedule",
      message: "Show the full schedule for this loan.",
    });
    actions.push({
      label: "Payment history",
      message: "Show the payments received on this loan.",
    });
  } else if (names.has("get_investor_position")) {
    actions.push({
      label: "Interest collected",
      message: "How much interest has this investor collected?",
    });
    const investor = sources.find((source) => source.type === "investor");
    if (investor?.href)
      actions.push({ label: "Open investor", href: investor.href });
  } else {
    actions.push({ label: "Due this week", message: "What is due this week?" });
    actions.push({
      label: "Overdue loans",
      message: "Which loans are overdue?",
    });
  }
  return actions.slice(0, 3);
}

export function fallbackBlocks(
  artifacts: ToolArtifact[],
  facts: Fact[],
): AssistantBlock[] {
  return buildBlocks(artifacts, facts);
}

export function fallbackText(artifacts: ToolArtifact[]): string {
  const names = new Set(artifacts.map((artifact) => artifact.name));
  if (names.size === 0) {
    return "I could not verify an answer from your records. Try asking with a borrower name or a date range.";
  }
  if (names.has("read_receipt_image")) {
    return "Here is what I could read from the image. Check the fields before saving anything.";
  }
  return "Here are the figures from your records. The table and the calculation below show exactly where they come from.";
}
