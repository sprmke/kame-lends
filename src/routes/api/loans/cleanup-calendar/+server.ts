import { json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { db } from "$lib/server/db";
import { loans } from "$lib/server/db/schema";
import { eq } from "drizzle-orm";
import { getSession } from "$lib/server/session";
import { deleteAllCalendarEvents } from "$lib/server/google-calendar";

// Delete ALL events from Google Calendar (complete cleanup for fresh start)
export const POST: RequestHandler = async (event) => {
  try {
    const session = await getSession(event);
    if (!session?.user?.id) {
      return json({ error: "Unauthorized" }, { status: 401 });
    }

    console.log("Starting COMPLETE cleanup of ALL Google Calendar events...");

    // Delete all events from Google Calendar
    const deletedCount = await deleteAllCalendarEvents();

    // Clear all googleCalendarEventIds from all user's loans
    await db
      .update(loans)
      .set({ googleCalendarEventIds: null })
      .where(eq(loans.userId, session.user.id));

    console.log("Cleared all calendar event IDs from loans database");

    return json({
      success: true,
      message: `Deleted ${deletedCount} events from Google Calendar. Calendar is now clean.`,
      deletedCount,
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
