import { eq, inArray, sql } from "drizzle-orm";
import { normalizeEmail } from "$lib/loan-signing";
import { db } from "$lib/server/db";
import {
  borrowers,
  debts,
  investors,
  loans,
  users,
  witnesses,
} from "$lib/server/db/schema";

/** Single sitewide workspace operator. Only this email may keep `users.role = admin`. */
export const WORKSPACE_OWNER_EMAIL = "michaeldmanlulu@gmail.com";

export function isWorkspaceOwnerEmail(
  email: string | null | undefined,
): boolean {
  const normalized = normalizeEmail(email);
  const owner = normalizeEmail(WORKSPACE_OWNER_EMAIL);
  return Boolean(normalized && owner && normalized === owner);
}

/** Strip mistaken `admin` roles from non-owner accounts. */
export function normalizeStoredUserRole(
  role: string | null | undefined,
  email: string | null | undefined,
): string | null {
  if (!role) return null;
  if (role === "admin" && !isWorkspaceOwnerEmail(email)) return null;
  return role;
}

/** Users who own CRM / loan workspace rows and should receive operator backups. */
export async function loadWorkspaceDataOwnerIds(): Promise<string[]> {
  const [loanRows, investorRows, borrowerRows, witnessRows, debtRows] =
    await Promise.all([
      db.selectDistinct({ userId: loans.userId }).from(loans),
      db.selectDistinct({ userId: investors.userId }).from(investors),
      db.selectDistinct({ userId: borrowers.userId }).from(borrowers),
      db.selectDistinct({ userId: witnesses.userId }).from(witnesses),
      db.selectDistinct({ userId: debts.userId }).from(debts),
    ]);

  return [
    ...new Set(
      [
        ...loanRows,
        ...investorRows,
        ...borrowerRows,
        ...witnessRows,
        ...debtRows,
      ]
        .map((row) => row.userId)
        .filter(Boolean),
    ),
  ];
}

export async function loadWorkspaceDataOwnerUsers() {
  const ids = await loadWorkspaceDataOwnerIds();
  if (ids.length === 0) return [];

  const owner = await db.query.users.findFirst({
    where: sql`lower(${users.email}) = ${normalizeEmail(WORKSPACE_OWNER_EMAIL)}`,
  });
  const mergedIds = owner ? [...new Set([...ids, owner.id])] : ids;

  return db.query.users.findMany({
    where: inArray(users.id, mergedIds),
  });
}

/** Ensure the sitewide owner row keeps `admin`; demote everyone else. */
export async function enforceWorkspaceOwnerRole(userId: string): Promise<void> {
  const user = await db.query.users.findFirst({
    where: eq(users.id, userId),
    columns: { id: true, email: true, role: true },
  });
  if (!user) return;

  if (isWorkspaceOwnerEmail(user.email)) {
    if (user.role !== "admin") {
      await db.update(users).set({ role: "admin" }).where(eq(users.id, userId));
    }
    return;
  }

  if (user.role === "admin") {
    await db.update(users).set({ role: null }).where(eq(users.id, userId));
  }
}
