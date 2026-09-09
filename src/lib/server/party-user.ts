import { eq } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { users } from '$lib/server/db/schema';
import { normalizeEmail } from '$lib/loan-signing';

export type PartyUserRole = 'investor' | 'borrower' | 'witness';

/**
 * Find or create an Auth.js user for a contact email.
 * Never demotes an existing admin.
 */
export async function findOrCreatePartyUser(input: {
	email: string;
	name?: string | null;
	role: PartyUserRole;
}): Promise<{ id: string; email: string; role: string } | null> {
	const email = normalizeEmail(input.email);
	if (!email) return null;

	const existing = await db.query.users.findFirst({
		where: eq(users.email, email)
	});

	if (existing) {
		if (existing.role === 'admin') {
			if (input.name?.trim() && !existing.name) {
				await db.update(users).set({ name: input.name.trim() }).where(eq(users.id, existing.id));
			}
			return existing;
		}

		const updates: { name?: string; role?: PartyUserRole } = {};
		if (input.name?.trim() && input.name.trim() !== existing.name) {
			updates.name = input.name.trim();
		}
		// Prefer investor over borrower over witness when upgrading a party role.
		const rank: Record<string, number> = {
			witness: 1,
			borrower: 2,
			investor: 3,
			admin: 4
		};
		if ((rank[input.role] ?? 0) > (rank[existing.role] ?? 0)) {
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
			role: input.role
		})
		.returning();

	return created;
}
