import { json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { getSession } from "$lib/server/session";
import { loadGroupWizardData } from "$lib/server/group-wizard-data";

export const GET: RequestHandler = async (event) => {
  const session = await getSession(event);
  if (!session?.user?.id) {
    return json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    return json(await loadGroupWizardData(session.user.id));
  } catch (error) {
    console.error("Error loading group wizard data:", error);
    return json({ error: "Failed to load wizard data" }, { status: 500 });
  }
};
