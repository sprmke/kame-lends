import { error } from "@sveltejs/kit";
import type { PageServerLoad } from "./$types";
import { db } from "$lib/server/db";
import { witnesses } from "$lib/server/db/schema";
import { eq, and } from "drizzle-orm";
import { requireUserSession } from "$lib/server/request-auth";

async function fetchOne(id: number, userId: string) {
  return db.query.witnesses.findFirst({
    where: and(eq(witnesses.id, id), eq(witnesses.userId, userId)),
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
  const entity = await fetchOne(id, session.user.id);
  if (!entity) throw error(404, "Not found");
  return { entity };
};
