import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { db } from "$lib/server/db";
import {
  loanContracts,
  loanSigningInvitations,
  userEmailPreferences,
} from "$lib/server/db/schema";
import { runEmailReminderDigests } from "$lib/server/email/reminders";
import { todayKey } from "$lib/dates/business-date";
import {
  cleanupLoanFixture,
  createLoanFixture,
  type LoanFixture,
} from "$lib/server/test/loan-fixture";

describe("email reminder digest runner", () => {
  let fixture: LoanFixture;
  let contractId: number;

  beforeEach(async () => {
    fixture = await createLoanFixture();
    const [contract] = await db
      .insert(loanContracts)
      .values({ loanId: fixture.loanId, customization: {} })
      .returning();
    contractId = contract.id;
  });

  afterEach(async () => {
    await db
      .delete(loanSigningInvitations)
      .where(eq(loanSigningInvitations.loanId, fixture.loanId));
    await db.delete(loanContracts).where(eq(loanContracts.id, contractId));
    await db
      .delete(userEmailPreferences)
      .where(eq(userEmailPreferences.userId, fixture.ownerId));
    await cleanupLoanFixture(fixture);
  });

  it("plans due and signing reminders without sending in dry-run", async () => {
    await db.insert(loanSigningInvitations).values({
      loanId: fixture.loanId,
      contractId,
      partyRole: "borrower",
      partyName: "Fixture Borrower",
      partyEmail: "fixture-borrower@example.test",
      createdAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
    });

    const result = await runEmailReminderDigests({
      todayKey: todayKey(),
      dryRun: true,
    });

    expect(result.users).toBeGreaterThanOrEqual(1);
    expect(result.planned).toBeGreaterThanOrEqual(1);
    expect(result.sent).toBe(0);
    expect(result.failed).toBe(0);
  });
});
