import { json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { db } from "$lib/server/db";
import { loanGroupLoans, groupCalendars, loans } from "$lib/server/db/schema";
import { and, eq, inArray } from "drizzle-orm";
import { getSession } from "$lib/server/session";
import {
  invalidateGroupData,
  invalidateLoanData,
} from "$lib/server/cache-invalidation";
import {
  hasGroupManageAccess,
  recomputeGroupMembers,
} from "$lib/server/group-access";
import { hasLoanAdminAccess } from "$lib/server/access-control";
import { bulkLoanIdsBodySchema, parseJsonBody } from "$lib/group-validation";
import { enqueueJob } from "$lib/server/jobs/queue";
import { scheduleDrain } from "$lib/server/jobs/after-response";

export const POST: RequestHandler = async (event) => {
  const { params, request } = event;
  try {
    const session = await getSession(event);
    if (!session?.user?.id) {
      return json({ error: "Unauthorized" }, { status: 401 });
    }

    const groupId = parseInt(params.id);
    if (!(await hasGroupManageAccess(groupId, session.user.id))) {
      return json({ error: "Group not found" }, { status: 404 });
    }

    const raw = await request.json();
    // Support legacy { loanId } and bulk { loanIds }
    const loanIds: number[] = Array.isArray(raw.loanIds)
      ? raw.loanIds.map(Number)
      : raw.loanId
        ? [Number(raw.loanId)]
        : [];
    if (loanIds.length === 0 || loanIds.some((id) => !Number.isFinite(id))) {
      return json({ error: "loanIds is required" }, { status: 400 });
    }

    for (const loanId of loanIds) {
      if (!(await hasLoanAdminAccess(loanId, session.user.id))) {
        return json(
          { error: `Cannot add loan ${loanId}: not the owner` },
          { status: 403 },
        );
      }
    }

    await db
      .insert(loanGroupLoans)
      .values(
        loanIds.map((loanId) => ({
          groupId,
          loanId,
          source: "manual" as const,
          addedByUserId: session.user!.id,
        })),
      )
      .onConflictDoNothing();

    await recomputeGroupMembers(groupId);

    try {
      const { applyGroupDefaultWitnessesToLoan } =
        await import("$lib/server/groups/apply-default-witnesses");
      for (const loanId of loanIds) {
        await applyGroupDefaultWitnessesToLoan(loanId);
      }
    } catch (witnessErr) {
      console.error("[groups] default witnesses failed", witnessErr);
    }

    const addedNames = await db.query.loans.findMany({
      where: inArray(loans.id, loanIds),
      columns: { id: true, loanName: true },
    });
    const addedNameById = new Map(
      addedNames.map((row) => [row.id, row.loanName]),
    );
    for (const loanId of loanIds) {
      await enqueueJob({
        kind: "group.calendar.syncLoan",
        groupId,
        payload: { loanId },
        dedupeKey: `group.calendar.syncLoan:${groupId}:${loanId}`,
      });
      const loanName = addedNameById.get(loanId)?.trim() || "Loan";
      await enqueueJob({
        kind: "group.telegram.activity",
        groupId,
        payload: {
          event: {
            type: "loan_added",
            entityId: loanId,
            loanId,
            updatedAt: new Date().toISOString(),
            summary: `Loan added: ${loanName}`,
          },
        },
      });
    }

    invalidateGroupData();
    invalidateLoanData();
    scheduleDrain(event);
    return json({ success: true, loanIds }, { status: 201 });
  } catch (error) {
    console.error("Error adding loans to group:", error);
    return json({ error: "Failed to add loans to group" }, { status: 500 });
  }
};

export const DELETE: RequestHandler = async (event) => {
  const { params, request } = event;
  try {
    const session = await getSession(event);
    if (!session?.user?.id) {
      return json({ error: "Unauthorized" }, { status: 401 });
    }

    const groupId = parseInt(params.id);
    if (!(await hasGroupManageAccess(groupId, session.user.id))) {
      return json({ error: "Group not found" }, { status: 404 });
    }

    const parsed = parseJsonBody(bulkLoanIdsBodySchema, await request.json());
    if ("error" in parsed) {
      return json({ error: parsed.error }, { status: 400 });
    }
    const { loanIds } = parsed.data;

    const calendar = await db.query.groupCalendars.findFirst({
      where: eq(groupCalendars.groupId, groupId),
      columns: { googleCalendarId: true },
    });

    const removedLoans = await db.query.loans.findMany({
      where: inArray(loans.id, loanIds),
      columns: {
        id: true,
        loanName: true,
        type: true,
        status: true,
      },
      with: {
        borrower: { columns: { name: true } },
        loanInvestors: { columns: { amount: true } },
      },
    });

    await db
      .delete(loanGroupLoans)
      .where(
        and(
          eq(loanGroupLoans.groupId, groupId),
          inArray(loanGroupLoans.loanId, loanIds),
        ),
      );

    await recomputeGroupMembers(groupId);

    for (const loanId of loanIds) {
      if (calendar?.googleCalendarId) {
        await enqueueJob({
          kind: "group.calendar.removeLoan",
          groupId,
          payload: { loanId, calendarId: calendar.googleCalendarId },
        });
      }
    }

    const removedAt = new Date().toISOString();
    for (const loan of removedLoans) {
      const principal = loan.loanInvestors.reduce((sum, row) => {
        const amount = Number.parseFloat(row.amount);
        return sum + (Number.isFinite(amount) ? amount : 0);
      }, 0);
      await enqueueJob({
        kind: "group.telegram.activity",
        groupId,
        payload: {
          event: {
            type: "loan_removed",
            entityId: loan.id,
            loanId: loan.id,
            updatedAt: removedAt,
            summary: `Loan removed: ${loan.loanName}`,
            detail: {
              loanName: loan.loanName,
              loanType: loan.type,
              status: loan.status,
              borrowerName: loan.borrower?.name ?? "",
              principal,
            },
          },
        },
      });
    }

    invalidateGroupData();
    invalidateLoanData();
    scheduleDrain(event);
    return json({ success: true, loanIds });
  } catch (error) {
    console.error("Error removing loans from group:", error);
    return json({ error: "Failed to remove loans" }, { status: 500 });
  }
};
