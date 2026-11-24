import type { AssistantMessageDto } from "$lib/assistant/types";
import type { GeminiContent } from "../transport";

const MAX_CHARS = 14_000;
const MAX_MESSAGES = 14;

function clip(text: string, max: number): string {
  const clean = text.replace(/\s+/g, " ").trim();
  return clean.length <= max ? clean : `${clean.slice(0, max)}…`;
}

/**
 * Thread memory only (ADR-7): recent turns, plus a deterministic summary of
 * older user questions. No standing preferences, no cross-thread memory.
 */
export function buildThreadHistory(
  messages: AssistantMessageDto[],
): GeminiContent[] {
  const recent = messages.slice(-MAX_MESSAGES);
  const older = messages.slice(0, Math.max(0, messages.length - MAX_MESSAGES));
  const contents: GeminiContent[] = [];

  if (older.length > 0) {
    const questions = older
      .filter((message) => message.role === "user")
      .slice(-6)
      .map((message) => clip(message.text, 160));
    contents.push({
      role: "user",
      parts: [
        {
          text: `<untrusted_data>Earlier questions in this thread: ${questions.join(" | ")}</untrusted_data>`,
        },
      ],
    });
    contents.push({
      role: "model",
      parts: [{ text: "Understood. I will keep this thread's context." }],
    });
  }

  for (const message of recent) {
    const text = clip(message.text, 2_000);
    if (!text) continue;
    contents.push({
      role: message.role === "assistant" ? "model" : "user",
      parts: [
        {
          text:
            message.role === "user"
              ? `<untrusted_data>${text}</untrusted_data>`
              : text,
        },
      ],
    });
  }

  // Hard character budget: drop the oldest turns first.
  let total = contents.reduce(
    (sum, content) =>
      sum +
      content.parts.reduce(
        (inner, part) => inner + (part.text?.length ?? 0),
        0,
      ),
    0,
  );
  while (total > MAX_CHARS && contents.length > 2) {
    const removed = contents.shift();
    total -= (removed?.parts ?? []).reduce(
      (sum, part) => sum + (part.text?.length ?? 0),
      0,
    );
  }
  return contents;
}

export function titleFromMessage(message: string): string {
  const clean = message.replace(/\s+/g, " ").trim();
  if (!clean) return "New chat";
  const clipped = clean.length > 60 ? `${clean.slice(0, 57)}…` : clean;
  return clipped.charAt(0).toUpperCase() + clipped.slice(1);
}
