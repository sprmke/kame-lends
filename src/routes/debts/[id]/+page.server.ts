import { error } from "@sveltejs/kit";
import type { PageServerLoad } from "./$types";
import { db } from "$lib/server/db";
import { debts } from "$lib/server/db/schema";
import { eq } from "drizzle-orm";
import { hasDebtAccess } from "$lib/server/access-control";
import { requireUserSession } from "$lib/server/request-auth";
import { isWorkspaceAdmin } from "$lib/server/workspace-admin";
async function fetchOne(id: number, userId: string) {
  if (!(await hasDebtAccess(id, userId))) return null;
  return db.query.debts.findFirst({
    where: eq(debts.id, id),
    with: {
      investor: true,
      interestPeriods: {
        with: { receivedPayments: true },
        orderBy: (periods, { asc }) => [asc(periods.periodNumber)],
      },
    },
  });
}

export const load: PageServerLoad = async (event) => {
  const session = requireUserSession(event);
  const id = Number(event.params.id);
  if (Number.isNaN(id)) throw error(400, "Invalid id");
  const entity = await fetchOne(id, session.user.id);
  if (!entity) throw error(404, "Not found");
  const canManage =
    entity.userId === session.user.id &&
    (await isWorkspaceAdmin(session.user.id));
  if (event.url.searchParams.get("edit") === "1" && !canManage) {
    throw error(403, "Read only");
  }
  return { entity, canManage };
};
