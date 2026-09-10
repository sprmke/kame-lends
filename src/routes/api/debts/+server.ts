import { json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { db } from "$lib/server/db";
import { debts } from "$lib/server/db/schema";
import { getSession } from "$lib/server/session";
import { parseDebtBody } from "$lib/debt-api";
import { syncDebtInterestPeriods } from "$lib/server/debt-interest-period-sync";
import { getCachedDebts } from "$lib/server/cached-data";
import { invalidateDebtData } from "$lib/server/cache-invalidation";
import { workspaceAdminForbidden } from "$lib/server/workspace-admin";

export const GET: RequestHandler = async (event) => {
  const request = event.request;
  try {
    const session = await getSession(event);
    if (!session?.user?.id) {
      return json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = session.user.id;
    const { searchParams } = new URL(request.url);
    const investorIdParam = searchParams.get("investorId");

    const investorId = investorIdParam ? parseInt(investorIdParam, 10) : null;
    return json(await getCachedDebts(userId, investorId));
  } catch (error) {
    console.error("Error fetching debts:", error);
    return json({ error: "Failed to fetch borrowings" }, { status: 500 });
  }
};

export const POST: RequestHandler = async (event) => {
  const request = event.request;
  try {
    const session = await getSession(event);
    if (!session?.user?.id) {
      return json({ error: "Unauthorized" }, { status: 401 });
    }
    const forbidden = await workspaceAdminForbidden(session.user.id);
    if (forbidden) return forbidden;

    const userId = session.user.id;
    const body = await request.json();

    const debtData = {
      ...parseDebtBody(body),
      userId,
    };

    const newDebt = await db.insert(debts).values(debtData).returning();
    await syncDebtInterestPeriods(newDebt[0].id);

    invalidateDebtData();
    return json(newDebt[0], { status: 201 });
  } catch (error) {
    console.error("Error creating debt:", error);
    const message =
      error instanceof Error ? error.message : "Failed to create borrowing";
    return json({ error: message }, { status: 500 });
  }
};
