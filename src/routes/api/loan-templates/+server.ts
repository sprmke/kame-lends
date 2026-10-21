import { json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { getSession } from "$lib/server/session";
import {
  createLoanTemplate,
  listLoanTemplatesForUser,
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

export const GET: RequestHandler = async (event) => {
  const session = await getSession(event);
  if (!session?.user?.id) {
    return json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const templates = await listLoanTemplatesForUser(session.user.id);
    return json(templates);
  } catch (error) {
    console.error("Error fetching loan templates:", error);
    return json({ error: "Failed to load templates" }, { status: 500 });
  }
};

export const POST: RequestHandler = async (event) => {
  const session = await getSession(event);
  if (!session?.user?.id) {
    return json({ error: "Unauthorized" }, { status: 401 });
  }

  const bodyResult = await readJsonBody(event.request);
  if (!bodyResult.ok) {
    return json({ error: bodyResult.error }, { status: 400 });
  }

  try {
    const result = await createLoanTemplate(session.user.id, bodyResult.data);
    if (!result.ok)
      return json({ error: result.error }, { status: result.status });
    return json(result.template, { status: 201 });
  } catch (error) {
    console.error("Error creating loan template:", error);
    return json({ error: "Failed to save template" }, { status: 500 });
  }
};
