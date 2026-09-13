/**
 * One-time migration: upload legacy data-URL images from Postgres to Cloudflare R2.
 *
 * Usage:
 *   bun scripts/db/backfill-storage-to-r2.ts
 *   bun scripts/db/backfill-storage-to-r2.ts --dry-run
 *
 * Requires R2_* env vars and DATABASE_URL (or .env.local).
 */
import "dotenv/config";
import { eq, or, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import {
  borrowers,
  investors,
  loanContracts,
  loanInvestors,
  loanSigningInvitations,
  receivedPayments,
  witnesses,
} from "../../src/lib/server/db/schema";
import { isDataImageUrl, toStorageRef } from "../../src/lib/storage-reference";
import {
  createUploadObjectKey,
  extensionForContentType,
  isR2Configured,
  putObjectBytes,
} from "../../src/lib/server/storage/r2";

const dryRun = process.argv.includes("--dry-run");

function parseDataUrl(
  dataUrl: string,
): { contentType: string; bytes: Uint8Array } | null {
  const match = /^data:([^;]+);base64,(.+)$/.exec(dataUrl);
  if (!match) return null;
  const contentType = match[1];
  const bytes = Uint8Array.from(Buffer.from(match[2], "base64"));
  return { contentType, bytes };
}

async function migrateValue(
  ownerUserId: string,
  value: string | null,
): Promise<string | null> {
  if (!value || !isDataImageUrl(value)) return value;

  const parsed = parseDataUrl(value);
  if (!parsed) return value;

  const ext = extensionForContentType(parsed.contentType);
  if (!ext) return value;

  const objectKey = createUploadObjectKey(ownerUserId, ext);
  const storageRef = toStorageRef(objectKey);

  if (dryRun) {
    console.log(`[dry-run] ${objectKey} (${parsed.bytes.length} bytes)`);
    return storageRef;
  }

  await putObjectBytes(objectKey, parsed.bytes, parsed.contentType);
  return storageRef;
}

async function migrateCustomization(
  ownerUserId: string,
  customization: unknown,
): Promise<{ changed: boolean; value: unknown }> {
  if (!customization || typeof customization !== "object") {
    return { changed: false, value: customization };
  }

  const next = { ...(customization as Record<string, unknown>) };
  let changed = false;
  const imageFields = [
    "witness1ValidIdUrl",
    "witness1ESignatureUrl",
    "witness2ValidIdUrl",
    "witness2ESignatureUrl",
  ] as const;

  for (const field of imageFields) {
    const current = next[field];
    if (typeof current !== "string" || !current.trim()) continue;
    const migrated = await migrateValue(ownerUserId, current);
    if (migrated !== current) {
      next[field] = migrated ?? "";
      changed = true;
    }
  }

  return { changed, value: next };
}

async function main() {
  const databaseUrl = process.env.DATABASE_URL?.trim();
  if (!databaseUrl) {
    throw new Error("DATABASE_URL is required.");
  }
  if (!dryRun && !isR2Configured()) {
    throw new Error("R2 env vars are required unless --dry-run is set.");
  }

  const sqlClient = postgres(databaseUrl, { max: 1 });
  const db = drizzle(sqlClient);

  let updated = 0;

  const partyTables = [
    { table: investors, label: "investors" },
    { table: borrowers, label: "borrowers" },
    { table: witnesses, label: "witnesses" },
  ] as const;

  for (const { table, label } of partyTables) {
    const rows = await db
      .select()
      .from(table)
      .where(
        or(
          sql`${table.validIdUrl} LIKE 'data:image/%'`,
          sql`${table.eSignatureUrl} LIKE 'data:image/%'`,
        ),
      );

    for (const row of rows) {
      const validIdUrl = await migrateValue(row.userId, row.validIdUrl);
      const eSignatureUrl = await migrateValue(row.userId, row.eSignatureUrl);
      if (
        validIdUrl === row.validIdUrl &&
        eSignatureUrl === row.eSignatureUrl
      ) {
        continue;
      }
      if (!dryRun) {
        await db
          .update(table)
          .set({ validIdUrl, eSignatureUrl })
          .where(eq(table.id, row.id));
      }
      updated += 1;
      console.log(`updated ${label}#${row.id}`);
    }
  }

  const receiptInvestorRows = await db
    .select({
      id: loanInvestors.id,
      userId: sql<string>`(SELECT user_id FROM loans WHERE loans.id = ${loanInvestors.loanId})`,
      receiptImageUrl: loanInvestors.receiptImageUrl,
    })
    .from(loanInvestors)
    .where(sql`${loanInvestors.receiptImageUrl} LIKE 'data:image/%'`);

  for (const row of receiptInvestorRows) {
    const receiptImageUrl = await migrateValue(row.userId, row.receiptImageUrl);
    if (receiptImageUrl === row.receiptImageUrl) continue;
    if (!dryRun) {
      await db
        .update(loanInvestors)
        .set({ receiptImageUrl })
        .where(eq(loanInvestors.id, row.id));
    }
    updated += 1;
    console.log(`updated loan_investors#${row.id} receipt`);
  }

  const paymentRows = await db
    .select({
      id: receivedPayments.id,
      userId: sql<string>`(
        SELECT loans.user_id
        FROM loan_investors
        INNER JOIN loans ON loans.id = loan_investors.loan_id
        WHERE loan_investors.id = ${receivedPayments.loanInvestorId}
      )`,
      receiptImageUrl: receivedPayments.receiptImageUrl,
    })
    .from(receivedPayments)
    .where(sql`${receivedPayments.receiptImageUrl} LIKE 'data:image/%'`);

  for (const row of paymentRows) {
    const receiptImageUrl = await migrateValue(row.userId, row.receiptImageUrl);
    if (receiptImageUrl === row.receiptImageUrl) continue;
    if (!dryRun) {
      await db
        .update(receivedPayments)
        .set({ receiptImageUrl })
        .where(eq(receivedPayments.id, row.id));
    }
    updated += 1;
    console.log(`updated received_payments#${row.id} receipt`);
  }

  const signingRows = await db
    .select({
      id: loanSigningInvitations.id,
      userId: sql<string>`(SELECT user_id FROM loans WHERE loans.id = ${loanSigningInvitations.loanId})`,
      signatureDataUrl: loanSigningInvitations.signatureDataUrl,
    })
    .from(loanSigningInvitations)
    .where(sql`${loanSigningInvitations.signatureDataUrl} LIKE 'data:image/%'`);

  for (const row of signingRows) {
    const signatureDataUrl = await migrateValue(
      row.userId,
      row.signatureDataUrl,
    );
    if (signatureDataUrl === row.signatureDataUrl) continue;
    if (!dryRun) {
      await db
        .update(loanSigningInvitations)
        .set({ signatureDataUrl })
        .where(eq(loanSigningInvitations.id, row.id));
    }
    updated += 1;
    console.log(`updated loan_signing_invitations#${row.id} signature`);
  }

  const contractRows = await db
    .select({
      id: loanContracts.id,
      loanId: loanContracts.loanId,
      customization: loanContracts.customization,
      userId: sql<string>`(SELECT user_id FROM loans WHERE loans.id = ${loanContracts.loanId})`,
    })
    .from(loanContracts);

  for (const row of contractRows) {
    const migrated = await migrateCustomization(row.userId, row.customization);
    if (!migrated.changed) continue;
    if (!dryRun) {
      await db
        .update(loanContracts)
        .set({ customization: migrated.value })
        .where(eq(loanContracts.id, row.id));
    }
    updated += 1;
    console.log(`updated loan_contracts#${row.id} (loan ${row.loanId})`);
  }

  console.log(`${dryRun ? "Would update" : "Updated"} ${updated} row(s).`);
  await sqlClient.end();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
