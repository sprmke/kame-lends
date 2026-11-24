import { APP_NAME } from "$lib/brand";
import { json, type RequestHandler } from "@sveltejs/kit";
import {
  isTransactionalEmailConfigured,
  sendTransactionalEmail,
} from "$lib/server/email/send-email";
import { renderEmailTest } from "$lib/server/email/notifications";
import { getUserEmailPreferences } from "$lib/server/email/preferences";
import { getSession } from "$lib/server/session";

export const POST: RequestHandler = async (event) => {
  const session = await getSession(event);
  if (!session?.user?.id || !session.user.email) {
    return json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!isTransactionalEmailConfigured()) {
    return json(
      { error: "Email is not configured on this server." },
      { status: 503 },
    );
  }

  const prefs = await getUserEmailPreferences(session.user.id);
  const built = renderEmailTest({
    recipient: {
      email: session.user.email,
      userId: session.user.id,
      name: session.user.name ?? "",
      roleLabels: [],
      preferences: prefs,
    },
  });

  try {
    await sendTransactionalEmail({
      to: session.user.email,
      subject: built.subject || `${APP_NAME}: Test email`,
      html: built.html,
    });
    return json({ sent: true });
  } catch (error) {
    console.error("[email] test send failed", {
      userId: session.user.id,
      error,
    });
    return json({ error: "Could not send test email." }, { status: 502 });
  }
};
