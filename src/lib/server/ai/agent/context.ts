/**
 * Per-turn tool context. Every field here is derived from the session or the
 * request envelope on the server; the model cannot set or widen any of it.
 */
import { dateKeyToUtcMidnight, todayKey } from "$lib/dates/business-date";
import type { SourceRef, ToolArtifact } from "$lib/assistant/types";
import { getDisabledTools } from "../config";
import type { FactStore } from "./facts";
import { ViewerData } from "$lib/server/assistant/viewer-data";

export interface AssistantPinInput {
  type: SourceRef["type"];
  id: number | string;
}

export interface AssistantReceiptContext {
  summary: string;
  fields: Record<string, string>;
  references: string[];
  recorded: Array<{
    referenceNumber: string;
    loanId: number;
    loanName: string;
    kind: string;
  }>;
  warnings: string[];
}

export interface ToolContext {
  userId: string;
  email: string | null;
  role: string | null;
  /** Manila business date key. */
  today: string;
  /** Current app route supplied by the client, e.g. `/loans/12`. */
  page: string | null;
  pins: SourceRef[];
  locale: "en" | "fil";
  facts: FactStore;
  viewer: ViewerData;
  /** Extracted fields from an image attached to this turn, if any. */
  receipt?: AssistantReceiptContext;
  artifacts: ToolArtifact[];
  disabledTools: Set<string>;
  signal?: AbortSignal;
  /** Turn deadline in epoch milliseconds. */
  deadlineAt: number;
  addArtifact(artifact: ToolArtifact): void;
}

const AS_OF_FORMAT = new Intl.DateTimeFormat("en-PH", {
  month: "short",
  day: "numeric",
  year: "numeric",
  timeZone: "UTC",
});

export function createToolContext(input: {
  userId: string;
  email: string | null;
  role: string | null;
  page: string | null;
  pins: SourceRef[];
  facts: FactStore;
  locale?: "en" | "fil";
  receipt?: AssistantReceiptContext;
  viewer?: ViewerData;
  deadlineAt: number;
  signal?: AbortSignal;
  today?: string;
}): ToolContext {
  const today = input.today ?? todayKey();
  const viewer =
    input.viewer ?? new ViewerData(input.userId, today, input.role);
  const artifacts: ToolArtifact[] = [];
  // Every answer can state an "as of" date without the model typing one.
  if (!input.facts.all().some((fact) => fact.label === "As of")) {
    input.facts.add({
      kind: "date",
      value: today,
      display: AS_OF_FORMAT.format(dateKeyToUtcMidnight(today)),
      label: "As of",
    });
  }
  return {
    userId: input.userId,
    email: input.email,
    role: input.role,
    today,
    page: input.page,
    pins: input.pins,
    locale: input.locale ?? "en",
    facts: input.facts,
    viewer,
    receipt: input.receipt,
    artifacts,
    disabledTools: getDisabledTools(),
    signal: input.signal,
    deadlineAt: input.deadlineAt,
    addArtifact(artifact: ToolArtifact) {
      artifacts.push(artifact);
    },
  };
}
