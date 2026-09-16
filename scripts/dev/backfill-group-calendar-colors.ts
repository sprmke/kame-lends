/**
 * Set Google Calendar event colors on group calendars (legacy action colors).
 *
 *   bun run dev:backfill-group-calendar-colors -- --dry-run
 *   bun run dev:backfill-group-calendar-colors -- --confirm
 *   bun run dev:backfill-group-calendar-colors -- --confirm --group-id=3
 *
 * Requires GOOGLE_SERVICE_ACCOUNT_* and DATABASE_URL in .env.local.
 */
import { config } from "dotenv";
import { eq, isNotNull } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import { google, type calendar_v3 } from "googleapis";
import postgres from "postgres";
import { envForScript } from "./env-local.ts";

config({ path: ".env.local" });

function resolveDatabaseUrl(env: Record<string, string | undefined>): string {
  const url = env.DATABASE_URL?.trim();
  if (url && !url.includes("...") && !url.includes("<")) return url;
  throw new Error(
    "DATABASE_URL is required in .env.local (or the environment).",
  );
}

function parseGroupId(): number | null {
  const arg = process.argv.find((a) => a.startsWith("--group-id="));
  if (!arg) return null;
  const id = Number(arg.split("=")[1]);
  return Number.isFinite(id) ? id : null;
}

async function main() {
  const dryRun = process.argv.includes("--dry-run");
  const confirm = process.argv.includes("--confirm");
  const groupIdFilter = parseGroupId();

  if (!dryRun && !confirm) {
    console.error("Pass --dry-run or --confirm");
    process.exit(1);
  }

  const env = envForScript();

  const { readGoogleServiceAccountCredentials, withGoogleCalendarRetry } =
    await import("../../src/lib/server/google-calendar-config.ts");
  const credentials = readGoogleServiceAccountCredentials(env);
  if (!credentials) {
    console.error(
      "Set GOOGLE_SERVICE_ACCOUNT_EMAIL / PRIVATE_KEY in .env.local",
    );
    process.exit(1);
  }

  const { googleCalendarColorIdForKind, resolveGoogleCalendarEventKind } =
    await import("../../src/lib/calendar-event-colors.ts");

  const { groupCalendars, loanGroups } =
    await import("../../src/lib/server/db/schema.ts");

  const sqlClient = postgres(resolveDatabaseUrl(env), { max: 1 });
  const db = drizzle(sqlClient);

  let calendarsQuery = db
    .select({
      groupId: groupCalendars.groupId,
      googleCalendarId: groupCalendars.googleCalendarId,
      groupName: loanGroups.name,
    })
    .from(groupCalendars)
    .innerJoin(loanGroups, eq(loanGroups.id, groupCalendars.groupId))
    .where(isNotNull(groupCalendars.googleCalendarId));

  const calendarRows = groupIdFilter
    ? (await calendarsQuery).filter((r) => r.groupId === groupIdFilter)
    : await calendarsQuery;

  if (calendarRows.length === 0) {
    console.log("No group calendars found.");
    return;
  }

  const auth = new google.auth.GoogleAuth({
    credentials: {
      client_email: credentials.clientEmail,
      private_key: credentials.privateKey,
    },
    scopes: ["https://www.googleapis.com/auth/calendar"],
  });
  const calendar = google.calendar({ version: "v3", auth });

  let scanned = 0;
  let updated = 0;
  let skipped = 0;
  let unknown = 0;

  for (const row of calendarRows) {
    const calendarId = row.googleCalendarId!;
    console.log(`\nGroup ${row.groupId} (${row.groupName}): ${calendarId}`);

    let pageToken: string | undefined;
    do {
      const listRes = await withGoogleCalendarRetry(() =>
        calendar.events.list({
          calendarId,
          singleEvents: true,
          maxResults: 250,
          pageToken,
        }),
      );
      const events = listRes.data.items ?? [];
      pageToken = listRes.data.nextPageToken ?? undefined;

      for (const event of events) {
        scanned += 1;
        const kind = resolveGoogleCalendarEventKind({
          kameKey: event.extendedProperties?.private?.kameKey,
          kameKind: event.extendedProperties?.private?.kameKind,
          summary: event.summary,
        });
        if (!kind) {
          unknown += 1;
          continue;
        }

        const wantColor = googleCalendarColorIdForKind(kind);
        if (event.colorId === wantColor) {
          skipped += 1;
          continue;
        }

        if (dryRun) {
          console.log(
            `  [dry-run] ${event.summary ?? "(no title)"}: color ${event.colorId ?? "default"} → ${wantColor} (${kind})`,
          );
          updated += 1;
          continue;
        }

        if (!event.id) continue;

        const patchBody: calendar_v3.Schema$Event = {
          colorId: wantColor,
          extendedProperties: {
            private: {
              ...event.extendedProperties?.private,
              kameKind: kind,
            },
          },
        };

        await withGoogleCalendarRetry(() =>
          calendar.events.patch({
            calendarId,
            eventId: event.id!,
            requestBody: patchBody,
          }),
        );
        updated += 1;
      }
    } while (pageToken);
  }

  console.log(
    `\nDone. Scanned ${scanned}, ${dryRun ? "would update" : "updated"} ${updated}, already correct ${skipped}, unrecognized ${unknown}.`,
  );

  await sqlClient.end({ timeout: 5 });
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
