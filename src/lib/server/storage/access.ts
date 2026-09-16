import { and, eq, or, sql } from "drizzle-orm";
import { receiptsContainStorageRef } from "$lib/payment-receipts";
import { parseStorageKey, toStorageRef } from "$lib/storage-reference";
import { db } from "$lib/server/db";
import {
  borrowers,
  investors,
  loanContracts,
  loanInvestors,
  loanSigningInvitations,
  loanWitnesses,
  loans,
  receivedPayments,
  witnesses,
} from "$lib/server/db/schema";
import { hasLoanViewAccess } from "$lib/server/access-control";

function uploadOwnerUserId(objectKey: string): string | null {
  const match = /^uploads\/([^/]+)\//.exec(objectKey);
  return match?.[1] ?? null;
}

async function refOnViewableLoan(
  userId: string,
  ref: string,
): Promise<boolean> {
  const investorLoan = await db
    .select({
      loanId: loanInvestors.loanId,
      receipts: loanInvestors.receipts,
      receiptImageUrl: loanInvestors.receiptImageUrl,
    })
    .from(loanInvestors)
    .where(
      or(
        eq(loanInvestors.receiptImageUrl, ref),
        sql`${loanInvestors.receipts}::text LIKE ${"%" + ref + "%"}`,
      ),
    )
    .limit(20);

  for (const row of investorLoan) {
    if (
      receiptsContainStorageRef(row, ref) &&
      (await hasLoanViewAccess(row.loanId, userId))
    ) {
      return true;
    }
  }

  const paymentLoan = await db
    .select({
      loanId: loanInvestors.loanId,
      receipts: receivedPayments.receipts,
      receiptImageUrl: receivedPayments.receiptImageUrl,
    })
    .from(receivedPayments)
    .innerJoin(
      loanInvestors,
      eq(loanInvestors.id, receivedPayments.loanInvestorId),
    )
    .where(
      or(
        eq(receivedPayments.receiptImageUrl, ref),
        sql`${receivedPayments.receipts}::text LIKE ${"%" + ref + "%"}`,
      ),
    )
    .limit(20);

  for (const row of paymentLoan) {
    if (
      receiptsContainStorageRef(row, ref) &&
      (await hasLoanViewAccess(row.loanId, userId))
    ) {
      return true;
    }
  }

  const borrowerLoan = await db
    .select({ loanId: loans.id })
    .from(loans)
    .innerJoin(borrowers, eq(borrowers.id, loans.borrowerId))
    .where(or(eq(borrowers.validIdUrl, ref), eq(borrowers.eSignatureUrl, ref)))
    .limit(20);

  for (const row of borrowerLoan) {
    if (await hasLoanViewAccess(row.loanId, userId)) return true;
  }

  const investorPartyLoan = await db
    .select({ loanId: loanInvestors.loanId })
    .from(loanInvestors)
    .innerJoin(investors, eq(investors.id, loanInvestors.investorId))
    .where(or(eq(investors.validIdUrl, ref), eq(investors.eSignatureUrl, ref)))
    .limit(20);

  for (const row of investorPartyLoan) {
    if (await hasLoanViewAccess(row.loanId, userId)) return true;
  }

  const witnessLoan = await db
    .select({ loanId: loanWitnesses.loanId })
    .from(loanWitnesses)
    .innerJoin(witnesses, eq(witnesses.id, loanWitnesses.witnessId))
    .where(or(eq(witnesses.validIdUrl, ref), eq(witnesses.eSignatureUrl, ref)))
    .limit(20);

  for (const row of witnessLoan) {
    if (await hasLoanViewAccess(row.loanId, userId)) return true;
  }

  const signingLoan = await db
    .select({ loanId: loanSigningInvitations.loanId })
    .from(loanSigningInvitations)
    .where(eq(loanSigningInvitations.signatureDataUrl, ref))
    .limit(20);

  for (const row of signingLoan) {
    if (await hasLoanViewAccess(row.loanId, userId)) return true;
  }

  const contractLoan = await db
    .select({ loanId: loanContracts.loanId })
    .from(loanContracts)
    .where(sql`${loanContracts.customization}::text LIKE ${`%${ref}%`}`)
    .limit(20);

  for (const row of contractLoan) {
    if (await hasLoanViewAccess(row.loanId, userId)) return true;
  }

  return false;
}

async function refOnLinkedPartyProfile(
  userId: string,
  ref: string,
): Promise<boolean> {
  const [investorHit, borrowerHit, witnessHit] = await Promise.all([
    db
      .select({ id: investors.id })
      .from(investors)
      .where(
        and(
          eq(investors.investorUserId, userId),
          or(eq(investors.validIdUrl, ref), eq(investors.eSignatureUrl, ref)),
        ),
      )
      .limit(1),
    db
      .select({ id: borrowers.id })
      .from(borrowers)
      .where(
        and(
          eq(borrowers.borrowerUserId, userId),
          or(eq(borrowers.validIdUrl, ref), eq(borrowers.eSignatureUrl, ref)),
        ),
      )
      .limit(1),
    db
      .select({ id: witnesses.id })
      .from(witnesses)
      .where(
        and(
          eq(witnesses.witnessUserId, userId),
          or(eq(witnesses.validIdUrl, ref), eq(witnesses.eSignatureUrl, ref)),
        ),
      )
      .limit(1),
  ]);

  return (
    investorHit.length > 0 || borrowerHit.length > 0 || witnessHit.length > 0
  );
}

export async function canReadStorageRef(
  userId: string,
  ref: string,
): Promise<boolean> {
  const objectKey = parseStorageKey(ref);
  if (!objectKey) return false;

  const ownerId = uploadOwnerUserId(objectKey);
  if (ownerId && ownerId === userId) return true;

  if (await refOnLinkedPartyProfile(userId, ref)) return true;

  if (await refOnOwnedCrmEntity(userId, ref)) return true;

  return refOnViewableLoan(userId, ref);
}

async function refOnOwnedCrmEntity(
  userId: string,
  ref: string,
): Promise<boolean> {
  const [investorHit, borrowerHit, witnessHit] = await Promise.all([
    db
      .select({ id: investors.id })
      .from(investors)
      .where(
        and(
          eq(investors.userId, userId),
          or(eq(investors.validIdUrl, ref), eq(investors.eSignatureUrl, ref)),
        ),
      )
      .limit(1),
    db
      .select({ id: borrowers.id })
      .from(borrowers)
      .where(
        and(
          eq(borrowers.userId, userId),
          or(eq(borrowers.validIdUrl, ref), eq(borrowers.eSignatureUrl, ref)),
        ),
      )
      .limit(1),
    db
      .select({ id: witnesses.id })
      .from(witnesses)
      .where(
        and(
          eq(witnesses.userId, userId),
          or(eq(witnesses.validIdUrl, ref), eq(witnesses.eSignatureUrl, ref)),
        ),
      )
      .limit(1),
  ]);

  return (
    investorHit.length > 0 || borrowerHit.length > 0 || witnessHit.length > 0
  );
}

export function assertStorageRef(ref: string): string {
  const key = parseStorageKey(ref);
  if (!key) {
    throw new Error("Invalid storage reference.");
  }
  return key;
}

export function buildStorageRefForKey(objectKey: string): string {
  return toStorageRef(objectKey);
}
