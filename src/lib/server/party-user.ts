import { eq } from "drizzle-orm";
import { db } from "$lib/server/db";
import { users } from "$lib/server/db/schema";
import { normalizeEmail } from "$lib/loan-signing";
import { findUserByNormalizedEmail } from "$lib/server/auth-sign-in";
import { isWorkspaceOwnerEmail } from "$lib/server/workspace-owner";

export type PartyUserRole = "investor" | "borrower" | "witness";

const PARTY_ROLE_RANK: Record<string, number> = {
  witness: 1,
  borrower: 2,
  investor: 3,
};

function partyRoleRank(role: string | null | undefined): number {
  if (!role || role === "admin") return 0;
  return PARTY_ROLE_RANK[role] ?? 0;
}

/**
 * Find or create one Auth.js user for a contact email.
 * The same person can be linked as investor, borrower, and witness.
 * Only the sitewide workspace owner may keep `role = admin`.
 */
export async function findOrCreatePartyUser(input: {
  email: string;
  name?: string | null;
  role: PartyUserRole;
}): Promise<{ id: string; email: string; role: string | null } | null> {
  const email = normalizeEmail(input.email);
  if (!email) return null;

  const existing = await findUserByNormalizedEmail(email);

  if (existing) {
    if (isWorkspaceOwnerEmail(existing.email)) {
      if (input.name?.trim() && !existing.name) {
        await db
          .update(users)
          .set({ name: input.name.trim() })
          .where(eq(users.id, existing.id));
      }
      return existing;
    }

    const updates: { name?: string; role?: PartyUserRole | null } = {};
    if (input.name?.trim() && input.name.trim() !== existing.name) {
      updates.name = input.name.trim();
    }
    if (partyRoleRank(input.role) > partyRoleRank(existing.role)) {
      updates.role = input.role;
    } else if (existing.role === "admin") {
      updates.role = input.role;
    }
    if (Object.keys(updates).length > 0) {
      const [updated] = await db
        .update(users)
        .set(updates)
        .where(eq(users.id, existing.id))
        .returning();
      return updated;
    }
    return existing;
  }

  const [created] = await db
    .insert(users)
    .values({
      email,
      name: input.name?.trim() || null,
      role: input.role,
    })
    .returning();

  return created;
}
