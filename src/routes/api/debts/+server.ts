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
import { debtWriteSchema, firstDebtError } from "$lib/schemas/debt";
import { parseIdParam } from "$lib/server/route-params";
import { recordMoneyAudit } from "$lib/server/money-audit";
import { publicJsonError } from "$lib/server/http-error";

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

    const investorId = investorIdParam ? parseIdParam(investorIdParam) : null;
    if (investorIdParam && investorId === null) {
      return json({ error: "Invalid investor id" }, { status: 400 });
    }
    return json(await getCachedDebts(userId, investorId));
  } catch (error) {
    console.error("Error fetching debts:", error);
    return json({ error: "Failed to fetch bank loans" }, { status: 500 });
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
    const parsed = debtWriteSchema.safeParse(body);
    if (!parsed.success) {
      return json({ error: firstDebtError(parsed.error) }, { status: 400 });
    }

    const debtData = {
      ...parseDebtBody(parsed.data as Record<string, unknown>),
      userId,
    };

    const newDebt = await db.transaction(async (tx) => {
      const inserted = await tx.insert(debts).values(debtData).returning();
      await recordMoneyAudit(tx, {
        actorUserId: userId,
        entityType: "debt",
        entityId: inserted[0].id,
        action: "create",
        after: { name: debtData.name, amount: debtData.amount },
      });
      await syncDebtInterestPeriods(inserted[0].id, tx as unknown as typeof db);
      return inserted;
    });

    invalidateDebtData();
    return json(newDebt[0], { status: 201 });
  } catch (error) {
    console.error("Error creating debt:", error);
    return json(publicJsonError("Failed to create bank loan", error), {
      status: 500,
    });
  }
};
