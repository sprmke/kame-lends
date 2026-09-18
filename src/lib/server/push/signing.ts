import { APP_NAME } from "$lib/brand";
import { db } from "$lib/server/db";
import { users } from "$lib/server/db/schema";
import { getUserPushPreferences } from "$lib/server/push/preferences";
import { sendPushToUser } from "$lib/server/push/web-push";
import { inArray } from "drizzle-orm";

export async function sendSigningPushForEmails(input: {
  loanId: number;
  loanName: string;
  emails: string[];
}): Promise<number> {
  const normalized = [
    ...new Set(input.emails.map((e) => e.trim().toLowerCase()).filter(Boolean)),
  ];
  if (normalized.length === 0) return 0;

  const matched = await db
    .select({ id: users.id, email: users.email })
    .from(users)
    .where(inArray(users.email, normalized));

  if (matched.length === 0) return 0;

  const path = `/loans/${input.loanId}/sign`;
  let sent = 0;

  for (const user of matched) {
    const prefs = await getUserPushPreferences(user.id);
    if (!prefs.notifySigning) continue;

    const fingerprint = `signing:${input.loanId}:${user.id}`;
    const outcome = await sendPushToUser(
      user.id,
      {
        title: APP_NAME,
        body: `Sign contract for ${input.loanName.trim() || "loan"}`,
        path,
        tag: fingerprint,
      },
      { fingerprint, kind: "signing" },
    );
    if (outcome.sent > 0) sent += 1;
  }

  return sent;
}
