import type { AssistantEvent } from "$lib/assistant/types";

/** Server-sent events: one JSON event per `data:` line. */
export function encodeEvent(event: AssistantEvent): string {
  return `data: ${JSON.stringify(event)}\n\n`;
}

export function encodeHeartbeat(): string {
  return `: heartbeat\n\n`;
}

export const SSE_HEADERS = {
  "Content-Type": "text/event-stream; charset=utf-8",
  "Cache-Control": "private, no-store, no-transform",
  Connection: "keep-alive",
  "X-Accel-Buffering": "no",
} as const;
