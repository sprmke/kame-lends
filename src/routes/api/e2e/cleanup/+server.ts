import { json } from "@sveltejs/kit";
import { env } from "$env/dynamic/private";
import type { RequestHandler } from "./$types";
import { and, inArray, isNotNull, sql } from "drizzle-orm";
import { db } from "$lib/server/db";
import {
  borrowers,
  integrationJobs,
  investors,
  loanSigningInvitations,
  loanWitnesses,
  loans,
  users,
  witnesses,
} from "$lib/server/db/schema";
import { normalizeEmail } from "$lib/loan-signing";

/**
 * Test-only cleanup for Playwright party fixtures.
 *
 * Saving a contact mirrors it into the other party tables and creates signing
 * invitations, so the normal role-specific DELETE cannot remove every row. This
 * endpoint removes those fixtures by email. It is disabled in production and
 * requires the E2E secret, same as `/api/e2e/session`.
 */
function isE2EAuthEnabled() {
  const secret = env.E2E_AUTH_SECRET?.trim();
  if (!secret) return false;
  if (env.VERCEL_ENV === "production") return false;
  return true;
}

export const POST: RequestHandler = async ({ request }) => {
  if (!isE2EAuthEnabled()) {
    return json({ error: "E2E auth is disabled" }, { status: 404 });
  }
  const provided = request.headers.get("x-e2e-auth-secret");
  if (!provided || provided !== env.E2E_AUTH_SECRET) {
    return json({ error: "Unauthorized" }, { status: 401 });
  }

  let emails: string[] = [];
  try {
    const body = (await request.json()) as { emails?: unknown };
    if (Array.isArray(body.emails)) {
      emails = body.emails
        .filter((value): value is string => typeof value === "string")
        .map((value) => normalizeEmail(value))
        .filter((value): value is string => Boolean(value));
    }
  } catch {
    return json({ error: "Invalid JSON" }, { status: 400 });
  }
  if (emails.length === 0) {
    return json({ error: "No emails" }, { status: 400 });
  }

  const borrowerRows = await db
    .select({ id: borrowers.id })
    .from(borrowers)
    .where(inArray(borrowers.email, emails));
  const borrowerIds = borrowerRows.map((row) => row.id);

  // The API soft-deletes loans; remove only soft-deleted fixture loans so the
  // borrower rows can be hard-deleted. Their queued integration jobs would
  // otherwise keep running against rows that no longer exist.
  if (borrowerIds.length > 0) {
    const deletedLoans = await db
      .select({ id: loans.id })
      .from(loans)
      .where(
        and(inArray(loans.borrowerId, borrowerIds), isNotNull(loans.deletedAt)),
      );
    const loanIds = deletedLoans.map((row) => row.id);
    if (loanIds.length > 0) {
      await db
        .delete(integrationJobs)
        .where(
          inArray(sql`(${integrationJobs.payload}->>'loanId')::int`, loanIds),
        );
      await db.delete(loans).where(inArray(loans.id, loanIds));
    }
  }

  const fixtureUsers = await db
    .select({ id: users.id })
    .from(users)
    .where(inArray(users.email, emails));
  const userIds = fixtureUsers.map((row) => row.id);
  if (userIds.length > 0) {
    await db
      .delete(integrationJobs)
      .where(inArray(sql`${integrationJobs.payload}->>'userId'`, userIds));
  }

  const witnessRows = await db
    .select({ id: witnesses.id })
    .from(witnesses)
    .where(inArray(witnesses.email, emails));
  const witnessIds = witnessRows.map((row) => row.id);

  await db
    .delete(loanSigningInvitations)
    .where(inArray(loanSigningInvitations.partyEmail, emails));
  if (witnessIds.length > 0) {
    await db
      .delete(loanSigningInvitations)
      .where(inArray(loanSigningInvitations.witnessId, witnessIds));
    await db
      .delete(loanWitnesses)
      .where(inArray(loanWitnesses.witnessId, witnessIds));
  }

  const deletedWitnesses = await db
    .delete(witnesses)
    .where(inArray(witnesses.email, emails))
    .returning();
  const deletedInvestors = await db
    .delete(investors)
    .where(inArray(investors.email, emails))
    .returning();
  const deletedBorrowers = await db
    .delete(borrowers)
    .where(inArray(borrowers.email, emails))
    .returning();
  const deletedUsers = await db
    .delete(users)
    .where(inArray(users.email, emails))
    .returning();

  return json({
    success: true,
    emails,
    deleted: {
      witnesses: deletedWitnesses.length,
      investors: deletedInvestors.length,
      borrowers: deletedBorrowers.length,
      users: deletedUsers.length,
    },
  });
};
