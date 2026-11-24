/**
 * Shared assistant types. Imported by both the server agent and the browser
 * panel, so nothing here may import server-only modules.
 */

export type FactKind = "money" | "count" | "percent" | "date" | "text";

export type SourceType =
  | "loan"
  | "borrower"
  | "investor"
  | "witness"
  | "debt"
  | "group"
  | "payment"
  | "period"
  | "help";

export interface SourceRef {
  type: SourceType;
  id: number | string;
  label?: string;
  href?: string;
}

export interface Fact {
  id: string;
  kind: FactKind;
  /** Raw value: centavos for money, number for count/percent. */
  value: number | string | null;
  display: string;
  label?: string;
  source?: SourceRef;
}

export interface CalcLine {
  label: string;
  display: string;
  valueC?: number;
  source?: SourceRef;
  note?: string;
}

export interface CalcGroup {
  label: string;
  lines: CalcLine[];
  subtotalDisplay?: string;
  subtotalC?: number;
}

/** Built from ledger fields by tools. The model never writes this. */
export interface CalcTrace {
  title: string;
  asOf: string;
  definition: string;
  groups: CalcGroup[];
  totalDisplay?: string;
  totalC?: number;
  caveats?: string[];
}

export interface TableColumn {
  key: string;
  label: string;
  align?: "left" | "right";
}

export interface TableRow {
  id?: string | number;
  href?: string;
  cells: Record<string, string | number | null>;
}

export interface ChartPoint {
  label: string;
  inflowC: number;
  outflowC: number;
}

export interface ToolArtifact {
  name: string;
  label: string;
  rows?: TableRow[];
  columns?: TableColumn[];
  chart?: ChartPoint[];
  calc?: CalcTrace;
  sources?: SourceRef[];
  notes?: string[];
  truncated?: boolean;
  asOf?: string;
}

export type StatTone = "default" | "positive" | "warning";

export interface StatBlock {
  label: string;
  value: string;
  hint?: string;
  tone?: StatTone;
}

export interface ActionLink {
  label: string;
  href?: string;
  message?: string;
}

export type AssistantBlock =
  | { type: "text"; markdown: string }
  | { type: "stat_list"; stats: StatBlock[] }
  | {
      type: "data_table";
      title?: string;
      columns: TableColumn[];
      rows: TableRow[];
      note?: string;
      copyable?: boolean;
    }
  | { type: "calc_breakdown"; trace: CalcTrace }
  | {
      type: "chart";
      title: string;
      points: ChartPoint[];
      note?: string;
    }
  | {
      type: "entity_card";
      entityType: "loan" | "borrower" | "investor" | "witness" | "debt";
      id: number;
      title: string;
      subtitle?: string;
      href: string;
      stats?: StatBlock[];
    }
  | {
      type: "callout";
      tone: "info" | "warn";
      title?: string;
      text: string;
    }
  | {
      type: "choice";
      prompt: string;
      options: Array<{ label: string; value: string; hint?: string }>;
    }
  | { type: "quick_actions"; actions: ActionLink[] }
  | { type: "source_chips"; sources: SourceRef[] }
  | { type: "refusal"; text: string }
  | { type: "error_hint"; text: string; code?: string };

export type AssistantPhase =
  "understanding" | "looking_up" | "computing" | "writing" | "checking";

export interface ToolStep {
  id: string;
  name: string;
  label: string;
  ok: boolean;
  ms: number;
  rows: number;
  reason?: string;
  /** Typed tool error code, used in the audit row. */
  code?: string;
}

export interface TurnTiming {
  totalMs: number;
  modelMs: number[];
  toolMs: number[];
  verifyMs: number;
}

export type AssistantEvent =
  | {
      type: "turn_started";
      conversationId: string;
      messageId: string;
      userMessageId: string;
    }
  | { type: "phase"; phase: AssistantPhase }
  | {
      type: "tool_start";
      id: string;
      name: string;
      label: string;
    }
  | {
      type: "tool_done";
      id: string;
      name: string;
      label: string;
      ok: boolean;
      ms: number;
      rows: number;
      reason?: string;
    }
  | { type: "text_start" }
  | { type: "text_delta"; text: string }
  | { type: "retract"; text: string }
  | { type: "turn_timing"; timing: TurnTiming }
  | {
      type: "blocks";
      blocks: AssistantBlock[];
      text: string;
      title?: string;
      guardMode: "ok" | "regenerated" | "fallback";
      sources?: SourceRef[];
    }
  | {
      type: "error";
      code: string;
      message: string;
      aborted?: boolean;
    };

export interface AssistantAttachment {
  kind: "image";
  mimeType: string;
  size: number;
  name?: string;
}

export interface AssistantMessageDto {
  id: string;
  role: "user" | "assistant";
  status: "streaming" | "complete" | "aborted" | "error";
  text: string;
  blocks: AssistantBlock[];
  attachments: AssistantAttachment[];
  createdAt: string;
  feedback: number | null;
  toolTrace?: ToolStep[];
}

export interface AssistantConversationDto {
  id: string;
  title: string;
  updatedAt: string;
  createdAt: string;
  pinnedContext?: SourceRef[];
}

export interface AssistantTurnRequest {
  conversationId?: string;
  message: string;
  pins?: SourceRef[];
  page?: string;
  imageDataUrl?: string;
  regenerate?: boolean;
  idempotencyKey?: string;
}

/** A pin or page context the server validated and returned for display. */
export interface AssistantPin {
  type: SourceRef["type"];
  id: number | string;
  label: string;
  href?: string;
}

export const MAX_MESSAGE_CHARS = 2_000;
export const MAX_PINS = 8;
export const MAX_IMAGE_BYTES = 3 * 1024 * 1024;
