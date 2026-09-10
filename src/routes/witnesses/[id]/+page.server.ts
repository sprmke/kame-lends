import { error } from "@sveltejs/kit";
import type { PageServerLoad } from "./$types";
import { db } from "$lib/server/db";
import { witnesses } from "$lib/server/db/schema";
import { eq } from "drizzle-orm";
import { requireUserSession } from "$lib/server/request-auth";
import { hasWitnessContactViewAccess } from "$lib/server/access-control";
import { isWorkspaceAdmin } from "$lib/server/workspace-admin";

async function fetchOne(id: number) {
  return db.query.witnesses.findFirst({
    where: eq(witnesses.id, id),
    with: {
      signingInvitations: {
        columns: {
          id: true,
          partyRole: true,
          signedAt: true,
        },
        with: {
          loan: {
            columns: {
              id: true,
              loanName: true,
              type: true,
              status: true,
              dueDate: true,
            },
          },
        },
      },
    },
  });
}

export const load: PageServerLoad = async (event) => {
  const session = requireUserSession(event);
  const id = Number(event.params.id);
  if (Number.isNaN(id)) throw error(400, "Invalid id");
  const entity = await fetchOne(id);
  if (!entity || !(await hasWitnessContactViewAccess(id, session.user.id))) {
    throw error(404, "Not found");
  }
  const canManage =
    entity.userId === session.user.id &&
    (await isWorkspaceAdmin(session.user.id));
  if (event.url.searchParams.get("edit") === "1" && !canManage) {
    throw error(403, "Read only");
  }
  return { entity, canManage };
};
