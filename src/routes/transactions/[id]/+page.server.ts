import { error } from "@sveltejs/kit";
import type { PageServerLoad } from "./$types";
import { db } from "$lib/server/db";
import { transactions } from "$lib/server/db/schema";
import { eq } from "drizzle-orm";
import { hasTransactionAccess } from "$lib/server/access-control";
import { requireUserSession } from "$lib/server/request-auth";
async function fetchOne(id: number, userId: string) {
  if (!(await hasTransactionAccess(id, userId))) return null;
  return db.query.transactions.findFirst({
    where: eq(transactions.id, id),
    with: { investor: true, loan: true },
  });
}

export const load: PageServerLoad = async (event) => {
  const session = requireUserSession(event);
  const id = Number(event.params.id);
  if (Number.isNaN(id)) throw error(400, "Invalid id");
  const entity = await fetchOne(id, session.user.id);
  if (!entity) throw error(404, "Not found");
  return { entity };
};
