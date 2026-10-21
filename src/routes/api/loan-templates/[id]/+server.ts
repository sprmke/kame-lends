import { json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { getSession } from "$lib/server/session";
import {
  deleteLoanTemplate,
  updateLoanTemplate,
} from "$lib/server/loan-templates";

async function readJsonBody(
  request: Request,
): Promise<{ ok: true; data: unknown } | { ok: false; error: string }> {
  try {
    return { ok: true, data: await request.json() };
  } catch {
    return { ok: false, error: "Invalid JSON body" };
  }
}

function templateId(params: { id?: string }): number | null {
  const id = Number(params.id);
  if (!Number.isInteger(id) || id <= 0) return null;
  return id;
}

export const PATCH: RequestHandler = async (event) => {
  const session = await getSession(event);
  if (!session?.user?.id) {
    return json({ error: "Unauthorized" }, { status: 401 });
  }

  const id = templateId(event.params);
  if (id == null) return json({ error: "Template not found" }, { status: 404 });

  const bodyResult = await readJsonBody(event.request);
  if (!bodyResult.ok) {
    return json({ error: bodyResult.error }, { status: 400 });
  }

  try {
    const result = await updateLoanTemplate(
      session.user.id,
      id,
      bodyResult.data,
    );
    if (!result.ok)
      return json({ error: result.error }, { status: result.status });
    return json(result.template);
  } catch (error) {
    console.error("Error updating loan template:", error);
    return json({ error: "Failed to save template" }, { status: 500 });
  }
};

export const DELETE: RequestHandler = async (event) => {
  const session = await getSession(event);
  if (!session?.user?.id) {
    return json({ error: "Unauthorized" }, { status: 401 });
  }

  const id = templateId(event.params);
  if (id == null) return json({ error: "Template not found" }, { status: 404 });

  try {
    const result = await deleteLoanTemplate(session.user.id, id);
    if (!result.ok)
      return json({ error: result.error }, { status: result.status });
    return json({ ok: true });
  } catch (error) {
    console.error("Error deleting loan template:", error);
    return json({ error: "Failed to delete template" }, { status: 500 });
  }
};
