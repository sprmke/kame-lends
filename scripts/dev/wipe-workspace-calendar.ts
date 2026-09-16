/**
 * Delete all events on GOOGLE_CALENDAR_ID (legacy workspace calendar).
 * Never deletes group calendars or calendar resources.
 *
 * Usage:
 *   bun scripts/dev/wipe-workspace-calendar.ts --dry-run
 *   bun scripts/dev/wipe-workspace-calendar.ts --confirm
 */
import { config } from "dotenv";
import { google } from "googleapis";
import { eq, isNotNull } from "drizzle-orm";
import { envForScript } from "./env-local.ts";

config({ path: ".env.local" });

const BATCH = 20;

async function main() {
  const dryRun = process.argv.includes("--dry-run");
  const confirm = process.argv.includes("--confirm");
  if (!dryRun && !confirm) {
    console.error("Pass --dry-run or --confirm");
    process.exit(1);
  }

  const { readGoogleCalendarConfig } =
    await import("../../src/lib/server/google-calendar-config.ts");
  const calendarConfig = readGoogleCalendarConfig(envForScript());
  if (!calendarConfig) {
    console.error(
      "Set GOOGLE_SERVICE_ACCOUNT_* and GOOGLE_CALENDAR_ID in .env.local",
    );
    process.exit(1);
  }
  const { calendarId, clientEmail, privateKey } = calendarConfig;
  if (calendarId === "primary") {
    console.error("Refusing to wipe primary calendar");
    process.exit(1);
  }

  const { db } = await import("../../src/lib/server/db/index.ts");
  const { groupCalendars } = await import("../../src/lib/server/db/schema.ts");

  const groupRows = await db
    .select({ googleCalendarId: groupCalendars.googleCalendarId })
    .from(groupCalendars)
    .where(isNotNull(groupCalendars.googleCalendarId));
  const protectedIds = new Set(
    groupRows.map((r) => r.googleCalendarId).filter(Boolean) as string[],
  );
  if (protectedIds.has(calendarId)) {
    console.error(
      "GOOGLE_CALENDAR_ID matches a group calendar. Aborting to protect group calendars.",
    );
    process.exit(1);
  }

  console.log(`Workspace calendar: ${calendarId}`);
  console.log(`Protected group calendar ids: ${protectedIds.size}`);

  const auth = new google.auth.GoogleAuth({
    credentials: { client_email: clientEmail, private_key: privateKey },
    scopes: ["https://www.googleapis.com/auth/calendar"],
  });
  const calendar = google.calendar({ version: "v3", auth });

  let listed = 0;
  let deleted = 0;
  let remaining = true;

  while (remaining) {
    const res = await calendar.events.list({
      calendarId,
      maxResults: BATCH,
      singleEvents: true,
    });
    const events = res.data.items ?? [];
    listed += events.length;
    if (events.length === 0) {
      remaining = false;
      break;
    }
    if (dryRun) {
      console.log(`Dry run: would delete ${events.length} event(s) this batch`);
      remaining = events.length >= BATCH;
      break;
    }
    for (const event of events) {
      if (!event.id) continue;
      await calendar.events.delete({ calendarId, eventId: event.id });
      deleted++;
    }
    remaining = events.length >= BATCH;
    console.log(`Deleted ${deleted} event(s) so far…`);
  }

  console.log(
    dryRun
      ? `Dry run complete. Listed ${listed} event(s) in first batch.`
      : `Wipe complete. Deleted ${deleted} event(s).`,
  );
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
