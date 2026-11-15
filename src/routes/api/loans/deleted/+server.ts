import { json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { db } from "$lib/server/db";
import { loans } from "$lib/server/db/schema";
import { and, desc, eq, isNotNull } from "drizzle-orm";
import { getSession } from "$lib/server/session";

/** Recently deleted loans for the owner (soft delete, D-8). */
export const GET: RequestHandler = async (event) => {
  try {
    const session = await getSession(event);
    const userId = session?.user?.id;
    if (!userId) {
      return json({ error: "Unauthorized" }, { status: 401 });
    }

    const rows = await db.query.loans.findMany({
      where: and(eq(loans.userId, userId), isNotNull(loans.deletedAt)),
      columns: {
        id: true,
        loanName: true,
        type: true,
        status: true,
        dueDate: true,
        deletedAt: true,
      },
      orderBy: [desc(loans.deletedAt)],
      limit: 50,
    });

    return json(rows);
  } catch (error) {
    console.error("Error fetching deleted loans:", error);
    return json({ error: "Failed to load deleted loans" }, { status: 500 });
  }
};
