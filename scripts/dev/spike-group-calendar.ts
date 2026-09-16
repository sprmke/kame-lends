/**
 * Phase 0.1 calendar spike (manual).
 * Requires GOOGLE_SERVICE_ACCOUNT_* in .env.local.
 *
 *   bun scripts/dev/spike-group-calendar.ts
 */
import { config } from "dotenv";
config({ path: ".env.local" });

async function main() {
  const { readGoogleServiceAccountCredentials } =
    await import("../../src/lib/server/google-calendar-config.ts");
  const creds = readGoogleServiceAccountCredentials(process.env);
  if (!creds) {
    console.error("Missing GOOGLE_SERVICE_ACCOUNT_EMAIL / PRIVATE_KEY");
    process.exit(1);
  }
  console.log("Service account OK:", creds.clientEmail);
  console.log(
    "Next: run calendars.insert / acl.insert against a throwaway calendar.",
  );
  console.log(
    "Subscribe URL shape: https://calendar.google.com/calendar/r?cid=<calendarId>",
  );
}

main();
