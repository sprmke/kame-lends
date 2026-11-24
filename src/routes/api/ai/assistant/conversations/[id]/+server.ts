import { json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { z } from "zod";
import { getSession } from "$lib/server/session";
import { isSameOriginRequest } from "$lib/server/same-origin";
import {
  archiveConversation,
  deleteConversation,
  getConversation,
  listMessages,
  renameConversation,
} from "$lib/server/ai/assistant/store";

const patchSchema = z
  .object({
    title: z.string().min(1).max(120).optional(),
    archived: z.boolean().optional(),
  })
  .strict();

function unauthorized() {
  return json({ error: "Unauthorized" }, { status: 401 });
}

function badId() {
  return json({ error: "Not found" }, { status: 404 });
}

export const GET: RequestHandler = async (event) => {
  const session = await getSession(event);
  if (!session?.user?.id) return unauthorized();
  const id = event.params.id ?? "";
  const conversation = await getConversation(session.user.id, id);
  if (!conversation) return badId();
  const messages = await listMessages(session.user.id, id, 200);
  return json(
    { conversation, messages },
    { headers: { "Cache-Control": "private, no-store" } },
  );
};

export const PATCH: RequestHandler = async (event) => {
  if (!isSameOriginRequest(event.request, event.url)) {
    return json({ error: "Invalid origin" }, { status: 403 });
  }
  const session = await getSession(event);
  if (!session?.user?.id) return unauthorized();
  const id = event.params.id ?? "";
  const parsed = patchSchema.safeParse(
    await event.request.json().catch(() => null),
  );
  if (!parsed.success) {
    return json({ error: "Invalid request" }, { status: 400 });
  }
  const existing = await getConversation(session.user.id, id);
  if (!existing) return badId();

  if (parsed.data.title !== undefined) {
    const ok = await renameConversation(session.user.id, id, parsed.data.title);
    if (!ok) return json({ error: "Invalid title" }, { status: 400 });
  }
  if (parsed.data.archived !== undefined) {
    await archiveConversation(session.user.id, id, parsed.data.archived);
  }
  const conversation = await getConversation(session.user.id, id);
  return json({ conversation });
};

export const DELETE: RequestHandler = async (event) => {
  if (!isSameOriginRequest(event.request, event.url)) {
    return json({ error: "Invalid origin" }, { status: 403 });
  }
  const session = await getSession(event);
  if (!session?.user?.id) return unauthorized();
  const id = event.params.id ?? "";
  const deleted = await deleteConversation(session.user.id, id);
  return deleted
    ? json({ deleted: true })
    : json({ error: "Not found" }, { status: 404 });
};
