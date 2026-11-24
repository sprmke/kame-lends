import type { RequestHandler } from "./$types";
import { json } from "@sveltejs/kit";
import { z } from "zod";
import { getSession } from "$lib/server/session";
import { isSameOriginRequest } from "$lib/server/same-origin";
import { runAgentTurn } from "$lib/server/ai/client";
import { AssistantRequestError } from "$lib/server/ai/agent/turn";
import {
  encodeEvent,
  encodeHeartbeat,
  SSE_HEADERS,
} from "$lib/server/ai/agent/stream";
import { isAiGatewayError } from "$lib/server/ai/errors";
import {
  claimIdempotencyKey,
  idempotencyKeyOf,
  purgeExpiredIdempotencyKeys,
} from "$lib/server/idempotency";
import type { AssistantEvent } from "$lib/assistant/types";

/** Leaves room to persist the answer before the platform cuts the function. */
export const config = { maxDuration: 60 };

const bodySchema = z
  .object({
    conversationId: z.string().uuid().optional(),
    message: z.string().min(1).max(2_000),
    pins: z
      .array(
        z.object({
          type: z.enum([
            "loan",
            "borrower",
            "investor",
            "witness",
            "debt",
            "group",
            "payment",
            "period",
          ]),
          id: z.union([z.number().int().positive(), z.string().min(1).max(64)]),
        }),
      )
      .max(8)
      .optional(),
    page: z.string().max(200).optional(),
    imageDataUrl: z.string().max(4_200_000).optional(),
    regenerate: z.boolean().optional(),
  })
  .strict();

/** Per-isolate guard. The durable rate limiter and idempotency key cover the rest. */
const liveStreams = new Map<string, number>();

function pruneLiveStreams(): void {
  const cutoff = Date.now() - 90_000;
  for (const [userId, startedAt] of liveStreams) {
    if (startedAt < cutoff) liveStreams.delete(userId);
  }
}

export const POST: RequestHandler = async (event) => {
  if (!isSameOriginRequest(event.request, event.url)) {
    return json(
      { error: "Invalid origin", code: "forbidden" },
      { status: 403 },
    );
  }
  const session = await getSession(event);
  const user = session?.user;
  const userId = user?.id;
  if (!userId) {
    return json({ error: "Unauthorized" }, { status: 401 });
  }
  const role = (user as { role?: string | null }).role ?? null;
  const email = user?.email ?? null;
  const displayName = user?.name ?? user?.email ?? "there";

  const parsed = bodySchema.safeParse(
    await event.request.json().catch(() => null),
  );
  if (!parsed.success) {
    return json(
      { error: "Invalid request", code: "bad_request" },
      { status: 400 },
    );
  }

  pruneLiveStreams();
  if (liveStreams.has(userId)) {
    return json(
      {
        error: "A question is already running. Wait for it to finish.",
        code: "busy",
        retryAfterSec: 5,
      },
      { status: 429, headers: { "Retry-After": "5" } },
    );
  }

  const key = idempotencyKeyOf(event.request);
  if (key) {
    const claimed = await claimIdempotencyKey(
      key,
      userId,
      "/api/ai/assistant",
    ).catch(() => true);
    if (!claimed) {
      return json(
        {
          error: "This question is already being answered.",
          code: "duplicate",
        },
        { status: 409 },
      );
    }
  }

  if (Math.random() < 0.05) void purgeExpiredIdempotencyKeys();
  liveStreams.set(userId, Date.now());
  const abort = new AbortController();
  event.request.signal.addEventListener("abort", () => abort.abort(), {
    once: true,
  });

  const request = parsed.data;
  const encoder = new TextEncoder();
  let heartbeat: ReturnType<typeof setInterval> | null = null;
  let closed = false;

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      const emit = (event: AssistantEvent) => {
        if (closed) return;
        try {
          controller.enqueue(encoder.encode(encodeEvent(event)));
        } catch {
          closed = true;
        }
      };
      heartbeat = setInterval(() => {
        if (closed) return;
        try {
          controller.enqueue(encoder.encode(encodeHeartbeat()));
        } catch {
          closed = true;
        }
      }, 15_000);

      void (async () => {
        try {
          await runAgentTurn({
            userId,
            email,
            role,
            displayName,
            message: request.message,
            pins: request.pins,
            page: request.page ?? null,
            imageDataUrl: request.imageDataUrl,
            conversationId: request.conversationId,
            regenerate: request.regenerate,
            signal: abort.signal,
            emit,
          });
        } catch (error) {
          if (error instanceof AssistantRequestError) {
            emit({
              type: "error",
              code: error.code,
              message: error.message,
              aborted: error.code === "aborted",
            });
          } else if (isAiGatewayError(error)) {
            emit({
              type: "error",
              code: error.code,
              message:
                error.code === "aborted"
                  ? "Stopped."
                  : "The assistant is unavailable right now.",
              aborted: error.code === "aborted",
            });
          } else {
            console.error("[ai.assistant] stream error", error);
            emit({
              type: "error",
              code: "internal",
              message: "The assistant could not finish that answer.",
            });
          }
        } finally {
          closed = true;
          if (heartbeat) clearInterval(heartbeat);
          liveStreams.delete(userId);
          try {
            controller.close();
          } catch {
            // Already closed by the client.
          }
        }
      })();
    },
    cancel() {
      closed = true;
      if (heartbeat) clearInterval(heartbeat);
      liveStreams.delete(userId);
      abort.abort();
    },
  });

  return new Response(stream, { headers: SSE_HEADERS });
};
