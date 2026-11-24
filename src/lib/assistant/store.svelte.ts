import type {
  AssistantBlock,
  AssistantConversationDto,
  AssistantMessageDto,
  AssistantPhase,
  ToolStep,
  SourceRef,
} from "./types";
import { streamAssistantTurn } from "./stream";

export interface AssistantPinChip {
  type: SourceRef["type"];
  id: number | string;
  label: string;
  href?: string;
}

function localId(prefix: string): string {
  return `${prefix}-${crypto.randomUUID()}`;
}

function nowIso(): string {
  return new Date().toISOString();
}

export class AssistantStore {
  messages = $state<AssistantMessageDto[]>([]);
  conversations = $state<AssistantConversationDto[]>([]);
  conversationId = $state<string | null>(null);
  streaming = $state(false);
  loading = $state(false);
  loadingHistory = $state(false);
  phase = $state<AssistantPhase | null>(null);
  steps = $state<ToolStep[]>([]);
  error = $state<{ code: string; message: string } | null>(null);
  pins = $state<AssistantPinChip[]>([]);
  page = $state<string | null>(null);
  feedbackBusy = $state<string | null>(null);
  private abort: AbortController | null = null;
  private initialized = false;
  private conversationLoad: Promise<void> | null = null;

  async init(input: { page?: string | null; conversationId?: string | null }) {
    this.page = input.page ?? null;
    if (this.initialized) {
      if (
        input.conversationId &&
        input.conversationId !== this.conversationId
      ) {
        await this.loadConversation(input.conversationId);
      }
      return;
    }
    this.initialized = true;
    await this.loadHistory();
    if (input.conversationId) await this.loadConversation(input.conversationId);
  }

  async loadHistory() {
    this.loadingHistory = true;
    try {
      const response = await fetch("/api/ai/assistant/conversations", {
        headers: { Accept: "application/json" },
      });
      if (!response.ok) return;
      const body = (await response.json()) as {
        conversations?: AssistantConversationDto[];
      };
      this.conversations = body.conversations ?? [];
    } catch {
      // History is optional; the thread still works.
    } finally {
      this.loadingHistory = false;
    }
  }

  async loadConversation(id: string) {
    this.conversationLoad = (async () => {
      this.loading = true;
      this.error = null;
      try {
        const response = await fetch(`/api/ai/assistant/conversations/${id}`, {
          headers: { Accept: "application/json" },
        });
        if (!response.ok) {
          if (response.status === 404) {
            this.conversationId = null;
            this.messages = [];
          }
          return;
        }
        const body = (await response.json()) as {
          conversation: AssistantConversationDto;
          messages: AssistantMessageDto[];
        };
        this.conversationId = body.conversation.id;
        this.messages = body.messages;
        this.pins = (body.conversation.pinnedContext ?? []).map((pin) => ({
          type: pin.type,
          id: pin.id,
          label: pin.label ?? `${pin.type} #${pin.id}`,
          href: pin.href,
        }));
        this.steps = [];
        this.phase = null;
      } catch {
        this.error = {
          code: "network",
          message: "Could not load this conversation.",
        };
      } finally {
        this.loading = false;
      }
    })();
    return this.conversationLoad;
  }

  newConversation() {
    if (this.streaming) return;
    this.conversationId = null;
    this.messages = [];
    this.steps = [];
    this.phase = null;
    this.error = null;
  }

  addPin(pin: AssistantPinChip) {
    if (this.pins.length >= 8) return;
    if (this.pins.some((item) => item.type === pin.type && item.id === pin.id))
      return;
    this.pins = [...this.pins, pin];
  }

  removePin(pin: AssistantPinChip) {
    this.pins = this.pins.filter(
      (item) => !(item.type === pin.type && item.id === pin.id),
    );
  }

  clearPins() {
    this.pins = [];
  }

  async send(text: string, imageDataUrl?: string) {
    const message = text.trim();
    if (!message || this.streaming) return;
    this.error = null;
    this.steps = [];
    this.phase = "understanding";

    const userLocal: AssistantMessageDto = {
      id: localId("user"),
      role: "user",
      status: "complete",
      text: message,
      blocks: [],
      attachments: imageDataUrl
        ? [{ kind: "image", mimeType: "image/jpeg", size: 0 }]
        : [],
      createdAt: nowIso(),
      feedback: null,
    };
    const assistantLocal: AssistantMessageDto = {
      id: localId("assistant"),
      role: "assistant",
      status: "streaming",
      text: "",
      blocks: [],
      attachments: [],
      createdAt: nowIso(),
      feedback: null,
    };
    this.messages = [...this.messages, userLocal, assistantLocal];
    this.streaming = true;
    this.abort = new AbortController();

    let assistantId = assistantLocal.id;
    let textBuffer = "";
    let terminal = false;

    try {
      const result = await streamAssistantTurn({
        body: {
          conversationId: this.conversationId ?? undefined,
          message,
          pins: this.pins.map((pin) => ({ type: pin.type, id: pin.id })),
          page: this.page ?? undefined,
          imageDataUrl,
        },
        idempotencyKey: crypto.randomUUID(),
        signal: this.abort.signal,
        onEvent: (event) => {
          if (event.type === "turn_started") {
            this.conversationId = event.conversationId;
            const previousAssistantId = assistantId;
            assistantId = event.messageId;
            this.messages = this.messages.map((item) =>
              item.id === userLocal.id
                ? { ...item, id: event.userMessageId }
                : item.id === previousAssistantId
                  ? { ...item, id: event.messageId }
                  : item,
            );
            return;
          }
          if (event.type === "phase") {
            this.phase = event.phase;
            return;
          }
          if (event.type === "tool_start") {
            this.steps = [
              ...this.steps,
              {
                id: event.id,
                name: event.name,
                label: event.label,
                ok: true,
                ms: 0,
                rows: 0,
              },
            ];
            return;
          }
          if (event.type === "tool_done") {
            this.steps = this.steps.map((step) =>
              step.id === event.id
                ? {
                    ...step,
                    label: event.label,
                    ok: event.ok,
                    ms: event.ms,
                    rows: event.rows,
                    reason: event.reason,
                  }
                : step,
            );
            return;
          }
          if (event.type === "text_delta") {
            textBuffer += event.text;
            this.patchMessage(assistantId, { text: textBuffer });
            return;
          }
          if (event.type === "retract") {
            textBuffer = event.text;
            this.patchMessage(assistantId, { text: textBuffer });
            return;
          }
          if (event.type === "blocks") {
            terminal = true;
            this.patchMessage(assistantId, {
              text: event.text,
              blocks: event.blocks,
              status: "complete",
            });
            this.phase = null;
            if (event.title) {
              void this.loadHistory();
            }
            return;
          }
          if (event.type === "error") {
            terminal = true;
            this.patchMessage(assistantId, {
              text:
                textBuffer ||
                event.message ||
                "The assistant could not finish that answer.",
              status: event.aborted ? "aborted" : "error",
            });
            this.error = { code: event.code, message: event.message };
            this.phase = null;
          }
        },
      });

      if (!result.ok) {
        const body = result.body as {
          error?: string;
          code?: string;
          retryAfterSec?: number;
        } | null;
        this.patchMessage(assistantId, {
          text:
            body?.error ??
            (result.status === 429
              ? "You are asking too quickly. Try again in a moment."
              : "The assistant is unavailable right now."),
          status: "error",
        });
        this.error = {
          code: body?.code ?? "http",
          message: body?.error ?? "Request failed.",
        };
      } else if (!terminal) {
        this.patchMessage(assistantId, { status: "complete" });
      }
    } catch (error) {
      const aborted =
        error instanceof DOMException && error.name === "AbortError";
      this.patchMessage(assistantId, {
        text: textBuffer,
        status: aborted ? "aborted" : "error",
      });
      if (!aborted) {
        this.error = {
          code: "network",
          message: "The connection dropped. Try again.",
        };
      }
    } finally {
      this.streaming = false;
      this.abort = null;
      if (this.conversationId) {
        await this.loadConversation(this.conversationId);
      }
      void this.loadHistory();
    }
  }

  async regenerate() {
    if (this.streaming || !this.conversationId) return;
    this.error = null;
    this.steps = [];
    this.phase = "understanding";
    const lastUserIndex = this.messages.findLastIndex(
      (message) => message.role === "user",
    );
    if (lastUserIndex >= 0) {
      // The server replaces the previous answer; mirror that here so the
      // streaming placeholder does not sit under a stale answer.
      this.messages = this.messages.slice(0, lastUserIndex + 1);
    }
    const assistantLocal: AssistantMessageDto = {
      id: localId("assistant"),
      role: "assistant",
      status: "streaming",
      text: "",
      blocks: [],
      attachments: [],
      createdAt: nowIso(),
      feedback: null,
    };
    this.messages = [...this.messages, assistantLocal];
    this.streaming = true;
    this.abort = new AbortController();
    let assistantId = assistantLocal.id;
    let textBuffer = "";
    try {
      const result = await streamAssistantTurn({
        body: {
          conversationId: this.conversationId,
          message: "regenerate",
          regenerate: true,
          page: this.page ?? undefined,
        },
        idempotencyKey: crypto.randomUUID(),
        signal: this.abort.signal,
        onEvent: (event) => {
          if (event.type === "turn_started") {
            const previousAssistantId = assistantId;
            assistantId = event.messageId;
            this.messages = this.messages.map((item) =>
              item.id === previousAssistantId
                ? { ...item, id: event.messageId }
                : item,
            );
            return;
          }
          if (event.type === "text_delta") {
            textBuffer += event.text;
            this.patchMessage(assistantId, { text: textBuffer });
          } else if (event.type === "blocks") {
            this.patchMessage(assistantId, {
              text: event.text,
              blocks: event.blocks,
              status: "complete",
            });
            this.phase = null;
          } else if (event.type === "error") {
            this.patchMessage(assistantId, {
              text: textBuffer || event.message,
              status: "error",
            });
            this.error = { code: event.code, message: event.message };
          } else if (event.type === "phase") {
            this.phase = event.phase;
          }
        },
      });
      if (!result.ok) {
        this.patchMessage(assistantId, {
          text: "Could not regenerate. Try again.",
          status: "error",
        });
      }
    } catch {
      this.patchMessage(assistantId, {
        text: textBuffer,
        status: "aborted",
      });
    } finally {
      this.streaming = false;
      this.abort = null;
      await this.loadConversation(this.conversationId);
    }
  }

  stop() {
    this.abort?.abort();
    this.abort = null;
  }

  async feedback(messageId: string, value: 1 | -1) {
    if (this.feedbackBusy) return;
    this.feedbackBusy = messageId;
    try {
      const response = await fetch("/api/ai/assistant/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messageId, value }),
      });
      if (response.ok) {
        this.messages = this.messages.map((message) =>
          message.id === messageId ? { ...message, feedback: value } : message,
        );
      }
    } finally {
      this.feedbackBusy = null;
    }
  }

  async renameConversation(id: string, title: string) {
    const clean = title.trim();
    if (!clean) return;
    const response = await fetch(`/api/ai/assistant/conversations/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: clean }),
    });
    if (response.ok) {
      this.conversations = this.conversations.map((conversation) =>
        conversation.id === id
          ? { ...conversation, title: clean }
          : conversation,
      );
    }
  }

  async deleteConversation(id: string) {
    const response = await fetch(`/api/ai/assistant/conversations/${id}`, {
      method: "DELETE",
    });
    if (!response.ok) return;
    this.conversations = this.conversations.filter(
      (conversation) => conversation.id !== id,
    );
    if (this.conversationId === id) this.newConversation();
  }

  async clearAll() {
    const response = await fetch("/api/ai/assistant/conversations", {
      method: "DELETE",
    });
    if (!response.ok) return;
    this.conversations = [];
    this.newConversation();
  }

  private patchMessage(id: string, patch: Partial<AssistantMessageDto>) {
    this.messages = this.messages.map((message) =>
      message.id === id ? { ...message, ...patch } : message,
    );
  }
}

export function blocksToText(blocks: AssistantBlock[]): string {
  return blocks
    .map((block) => {
      if (block.type === "data_table") {
        return [
          block.columns.map((column) => column.label).join("\t"),
          ...block.rows.map((row) =>
            block.columns
              .map((column) => String(row.cells[column.key] ?? ""))
              .join("\t"),
          ),
        ].join("\n");
      }
      if (block.type === "stat_list") {
        return block.stats
          .map((stat) => `${stat.label}: ${stat.value}`)
          .join("\n");
      }
      return "";
    })
    .filter(Boolean)
    .join("\n\n");
}
