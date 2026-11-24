import type { AssistantEvent } from "./types";

/**
 * Pure SSE parser for the assistant stream. Kept free of Svelte and fetch so it
 * can be unit tested and reused by the eval harness and the E2E mock.
 */
export class AssistantStreamParser {
  private buffer = "";

  constructor(private readonly onEvent: (event: AssistantEvent) => void) {}

  feed(chunk: string): void {
    this.buffer += chunk;
    let boundary = this.buffer.indexOf("\n\n");
    while (boundary >= 0) {
      const block = this.buffer.slice(0, boundary);
      this.buffer = this.buffer.slice(boundary + 2);
      this.handleBlock(block);
      boundary = this.buffer.indexOf("\n\n");
    }
  }

  end(): void {
    if (this.buffer.trim()) {
      this.handleBlock(this.buffer);
      this.buffer = "";
    }
  }

  private handleBlock(block: string): void {
    const data = block
      .split("\n")
      .filter((line) => line.startsWith("data:"))
      .map((line) => line.slice(5).trimStart())
      .join("\n");
    if (!data) return;
    try {
      const parsed = JSON.parse(data) as AssistantEvent;
      if (parsed && typeof parsed === "object" && "type" in parsed) {
        this.onEvent(parsed);
      }
    } catch {
      // A malformed event is ignored; the turn error path still closes the UI.
    }
  }
}

export interface StreamTurnOptions {
  body: Record<string, unknown>;
  signal?: AbortSignal;
  idempotencyKey?: string;
  onEvent: (event: AssistantEvent) => void;
}

export async function streamAssistantTurn(
  options: StreamTurnOptions,
): Promise<{ ok: boolean; status: number; body?: unknown }> {
  const response = await fetch("/api/ai/assistant", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "text/event-stream",
      ...(options.idempotencyKey
        ? { "Idempotency-Key": options.idempotencyKey }
        : {}),
    },
    body: JSON.stringify(options.body),
    signal: options.signal,
  });

  if (!response.ok || !response.body) {
    const body = await response.json().catch(() => null);
    return { ok: false, status: response.status, body };
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  const parser = new AssistantStreamParser(options.onEvent);
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    parser.feed(decoder.decode(value, { stream: true }));
  }
  parser.end();
  return { ok: true, status: response.status };
}
