import { sql } from "drizzle-orm";
import { normalizeEmail } from "$lib/loan-signing";
import { db } from "$lib/server/db";
import { users } from "$lib/server/db/schema";

/**
 * Product policy (P0-1): any Google account with a normalizable email may sign in.
 * New users get their own empty workspace (`users.role` null unless workspace owner).
 * `allowDangerousEmailAccountLinking` is on so party CRM rows that already
 * store that email attach to the same Auth.js user. Threat: an attacker who
 * controls a party email inbox can link that Google account and see loans
 * they were invited to. Mitigation: membership still required for loan view;
 * blank invitation emails do not grant access.
 */
export function isGoogleSignInAllowed(input: {
  email: string | null | undefined;
  existingUser: boolean;
  workspaceHasUsers: boolean;
}): boolean {
  void input.existingUser;
  void input.workspaceHasUsers;
  return Boolean(normalizeEmail(input.email));
}

export function signInErrorMessage(
  error: string | null | undefined,
): string | null {
  if (!error) return null;
  if (error === "AccessDenied") {
    return "Sign-in is not allowed for this Google account.";
  }
  return "Sign-in failed. Try again.";
}

export async function findUserByNormalizedEmail(
  email: string | null | undefined,
) {
  const normalized = normalizeEmail(email);
  if (!normalized) return null;
  return (
    (await db.query.users.findFirst({
      where: sql`lower(${users.email}) = ${normalized}`,
    })) ?? null
  );
}

export async function workspaceHasUsers(): Promise<boolean> {
  const row = await db.select({ id: users.id }).from(users).limit(1);
  return row.length > 0;
}
