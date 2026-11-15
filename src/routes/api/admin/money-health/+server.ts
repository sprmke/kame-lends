import { json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { getSession } from "$lib/server/session";
import { isWorkspaceOwnerEmail } from "$lib/server/workspace-owner";
import { runMoneyHealthChecks } from "$lib/server/money-health";
import { publicJsonError } from "$lib/server/http-error";

/** Admin-only, read-only money health report (D-12, T8.4). */
export const GET: RequestHandler = async (event) => {
  try {
    const session = await getSession(event);
    if (!session?.user?.id) {
      return json({ error: "Unauthorized" }, { status: 401 });
    }
    if (!isWorkspaceOwnerEmail(session.user.email)) {
      return json({ error: "Forbidden" }, { status: 403 });
    }

    const checks = await runMoneyHealthChecks();
    return json({
      generatedAt: new Date().toISOString(),
      totalAnomalies: checks.reduce((sum, check) => sum + check.count, 0),
      checks,
    });
  } catch (error) {
    console.error("Error running money health checks:", error);
    return json(publicJsonError("Failed to run health checks", error), {
      status: 500,
    });
  }
};
