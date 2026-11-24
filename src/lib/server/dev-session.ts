import { dev } from "$app/environment";
import { env } from "$env/dynamic/private";
import { db } from "$lib/server/db";
import { sessions, users } from "$lib/server/db/schema";
import { normalizeEmail } from "$lib/loan-signing";
import { sql } from "drizzle-orm";

const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24;
const DEFAULT_DEV_EMAIL = "e2e@example.com";

/**
 * Local-only password-free sign-in for the seeded dev account.
 *
 * Only enabled under `vite dev` with the Docker Postgres on :5433. It never
 * runs in a build or against a hosted database.
 */
export function isLocalDevLoginEnabled(): boolean {
  if (!dev) return false;
  if (env.VERCEL_ENV === "production") return false;
  const url = env.DATABASE_URL ?? "";
  return /^postgres(ql)?:\/\/[^@]*@(127\.0\.0\.1|localhost):\d+\//.test(url);
}

export function devLoginEmail(): string {
  return normalizeEmail(env.E2E_USER_EMAIL) || DEFAULT_DEV_EMAIL;
}

export async function createDevSession() {
  const email = devLoginEmail();
  let user = await db.query.users.findFirst({
    where: sql`lower(${users.email}) = ${email}`,
  });

  if (!user) {
    [user] = await db
      .insert(users)
      .values({
        email,
        name: "Local Test Admin",
        role: "admin",
        emailVerified: new Date(),
      })
      .returning();
  }

  const sessionToken = crypto.randomUUID();
  const expires = new Date(Date.now() + SESSION_MAX_AGE_SECONDS * 1000);
  await db.insert(sessions).values({ sessionToken, userId: user.id, expires });

  return { user, sessionToken };
}
