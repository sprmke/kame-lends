import { json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { db } from "$lib/server/db";
import { loans } from "$lib/server/db/schema";
import { eq } from "drizzle-orm";
import { getSession } from "$lib/server/session";
import { deleteCalendarEventBatch } from "$lib/server/google-calendar";

export const config = {
  maxDuration: 60,
};

export const POST: RequestHandler = async (event) => {
  try {
    const session = await getSession(event);
    if (!session?.user?.id) {
      return json({ error: "Unauthorized" }, { status: 401 });
    }

    const batch = await deleteCalendarEventBatch(20);
    if (!batch.remaining) {
      await db
        .update(loans)
        .set({ googleCalendarEventIds: null })
        .where(eq(loans.userId, session.user.id));
    }

    return json({
      success: true,
      deleted: batch.deleted,
      remaining: batch.remaining,
      deletedCount: batch.deleted,
    });
  } catch (error) {
    console.error("Error cleaning up calendar events:", error);
    return json(
      {
        error: "Failed to cleanup calendar events",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
};
