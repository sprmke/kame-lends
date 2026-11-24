import { json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { db } from "$lib/server/db";
import { debtReceivedPayments, debts } from "$lib/server/db/schema";
import { eq, and, isNull } from "drizzle-orm";
import { getSession } from "$lib/server/session";
import { hasDebtAccess, hasDebtAdminAccess } from "$lib/server/access-control";
import { parseDebtBody } from "$lib/debt-api";
import { syncDebtInterestPeriods } from "$lib/server/debt-interest-period-sync";
import { invalidateDebtData } from "$lib/server/cache-invalidation";
import { debtWriteSchema, firstDebtError } from "$lib/schemas/debt";
import { parseIdParam } from "$lib/server/route-params";
import { recordMoneyAudit } from "$lib/server/money-audit";

export const GET: RequestHandler = async (event) => {
  const { params, request } = event;
  try {
    const session = await getSession(event);
    const userId = session?.user?.id;
    if (!userId) {
      return json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id: paramId } = await params;
    const id = parseIdParam(paramId);
    if (id === null) {
      return json({ error: "Invalid bank loan id" }, { status: 400 });
    }

    const hasAccess = await hasDebtAccess(id, userId);
    if (!hasAccess) {
      return json({ error: "Bank loan not found" }, { status: 404 });
    }

    const debt = await db.query.debts.findFirst({
      where: and(eq(debts.id, id), isNull(debts.deletedAt)),
      with: {
        investor: true,
        interestPeriods: {
          with: {
            receivedPayments: {
              where: isNull(debtReceivedPayments.deletedAt),
            },
          },
          orderBy: (periods, { asc }) => [asc(periods.periodNumber)],
        },
      },
    });

    if (!debt) {
      return json({ error: "Bank loan not found" }, { status: 404 });
    }

    await syncDebtInterestPeriods(id);

    const debtWithPeriods = await db.query.debts.findFirst({
      where: and(eq(debts.id, id), isNull(debts.deletedAt)),
      with: {
        investor: true,
        interestPeriods: {
          with: {
            receivedPayments: {
              where: isNull(debtReceivedPayments.deletedAt),
            },
          },
          orderBy: (periods, { asc }) => [asc(periods.periodNumber)],
        },
      },
    });

    return json(debtWithPeriods);
  } catch (error) {
    console.error("Error fetching debt:", error);
    return json({ error: "Failed to fetch bank loan" }, { status: 500 });
  }
};

export const PUT: RequestHandler = async (event) => {
  const { params, request } = event;
  try {
    const session = await getSession(event);
    const userId = session?.user?.id;
    if (!userId) {
      return json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id: paramId } = await params;
    const id = parseIdParam(paramId);
    if (id === null) {
      return json({ error: "Invalid bank loan id" }, { status: 400 });
    }
    const body = await request.json();
    const parsed = debtWriteSchema.safeParse(body);
    if (!parsed.success) {
      return json({ error: firstDebtError(parsed.error) }, { status: 400 });
    }

    const hasAccess = await hasDebtAdminAccess(id, userId);
    if (!hasAccess) {
      return json({ error: "Bank loan not found" }, { status: 404 });
    }

    const existingDebt = await db.query.debts.findFirst({
      where: eq(debts.id, id),
    });

    if (!existingDebt) {
      return json({ error: "Bank loan not found" }, { status: 404 });
    }

    const debtData = {
      ...parseDebtBody(parsed.data as Record<string, unknown>),
      updatedAt: new Date(),
    };

    const updatedDebt = await db.transaction(async (tx) => {
      const updated = await tx
        .update(debts)
        .set(debtData)
        .where(and(eq(debts.id, id), eq(debts.userId, userId)))
        .returning();

      if (updated.length === 0) return updated;

      await recordMoneyAudit(tx, {
        actorUserId: userId,
        entityType: "debt",
        entityId: id,
        action: "update",
        before: { name: existingDebt.name, amount: existingDebt.amount },
        after: { name: debtData.name, amount: debtData.amount },
      });

      await syncDebtInterestPeriods(id, tx as unknown as typeof db);
      return updated;
    });

    if (updatedDebt.length === 0) {
      return json({ error: "Bank loan not found" }, { status: 404 });
    }

    const debtWithPeriods = await db.query.debts.findFirst({
      where: and(eq(debts.id, id), isNull(debts.deletedAt)),
      with: {
        investor: true,
        interestPeriods: {
          with: {
            receivedPayments: {
              where: isNull(debtReceivedPayments.deletedAt),
            },
          },
          orderBy: (periods, { asc }) => [asc(periods.periodNumber)],
        },
      },
    });

    invalidateDebtData();
    return json(debtWithPeriods);
  } catch (error) {
    console.error("Error updating debt:", error);
    return json({ error: "Failed to update bank loan" }, { status: 500 });
  }
};

export const DELETE: RequestHandler = async (event) => {
  const { params, request } = event;
  try {
    const session = await getSession(event);
    const userId = session?.user?.id;
    if (!userId) {
      return json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id: paramId } = await params;
    const id = parseIdParam(paramId);
    if (id === null) {
      return json({ error: "Invalid bank loan id" }, { status: 400 });
    }

    const hasAccess = await hasDebtAdminAccess(id, userId);
    if (!hasAccess) {
      return json({ error: "Bank loan not found" }, { status: 404 });
    }

    const existing = await db.query.debts.findFirst({
      where: eq(debts.id, id),
      columns: { id: true, name: true, amount: true },
    });
    if (!existing) {
      return json({ error: "Bank loan not found" }, { status: 404 });
    }

    await db.transaction(async (tx) => {
      await tx
        .update(debts)
        .set({ deletedAt: new Date(), updatedAt: new Date() })
        .where(eq(debts.id, id));
      await recordMoneyAudit(tx, {
        actorUserId: userId,
        entityType: "debt",
        entityId: id,
        action: "delete",
        before: { name: existing.name, amount: existing.amount },
        reason: "soft delete",
      });
    });

    invalidateDebtData();
    return json({ success: true });
  } catch (error) {
    console.error("Error deleting debt:", error);
    return json({ error: "Failed to delete bank loan" }, { status: 500 });
  }
};
