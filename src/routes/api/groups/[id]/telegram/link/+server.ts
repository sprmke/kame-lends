import { json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { createHash, randomBytes } from "node:crypto";
import { and, eq, isNull } from "drizzle-orm";
import { db } from "$lib/server/db";
import { telegramLinkTokens } from "$lib/server/db/schema";
import { getSession } from "$lib/server/session";
import { hasGroupManageAccess } from "$lib/server/group-access";
import { readTelegramConfig } from "$lib/server/telegram/config";

const TOKEN_TTL_MS = 30 * 60 * 1000;

export const POST: RequestHandler = async (event) => {
  try {
    const session = await getSession(event);
    if (!session?.user?.id) {
      return json({ error: "Unauthorized" }, { status: 401 });
    }

    const groupId = parseInt(event.params.id);
    if (!(await hasGroupManageAccess(groupId, session.user.id))) {
      return json({ error: "Group not found" }, { status: 404 });
    }

    const config = readTelegramConfig();
    if (!config) {
      return json({ error: "Telegram is not configured" }, { status: 503 });
    }

    const token = randomBytes(32).toString("base64url");
    const tokenHash = createHash("sha256").update(token).digest("hex");
    const expiresAt = new Date(Date.now() + TOKEN_TTL_MS);
    const now = new Date();

    // Invalidate unused prior tokens so an intercepted older link cannot bind.
    await db
      .update(telegramLinkTokens)
      .set({ usedAt: now })
      .where(
        and(
          eq(telegramLinkTokens.groupId, groupId),
          isNull(telegramLinkTokens.usedAt),
        ),
      );

    await db.insert(telegramLinkTokens).values({
      groupId,
      tokenHash,
      createdByUserId: session.user.id,
      expiresAt,
    });

    const url = `https://t.me/${config.botUsername}?startgroup=${token}`;

    return json({ url, expiresAt: expiresAt.toISOString() });
  } catch (error) {
    console.error("[telegram] link token", error);
    return json({ error: "Failed to create link" }, { status: 500 });
  }
};
