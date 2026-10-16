/**
 * Assign borrower "Precious Natividad" on Lot Title loans that have no
 * borrower and no assigned witness.
 *
 * Usage:
 *   bun run db:assign:lot-borrower --dry-run
 *   bun run db:assign:lot-borrower
 *   bun run db:assign:lot-borrower --use-hosted --dry-run
 *   bun run db:assign:lot-borrower --use-hosted
 *
 * Hosted writes use DATABASE_URL_PROD. This repo's only Neon branch is
 * named production (same URL as Vercel). Back up first: bun run backup:neon
 */
import postgres from "postgres";

const BORROWER_NAME = "Precious Natividad";

const args = process.argv.slice(2);
const dryRun = args.includes("--dry-run");

function loadDatabaseUrl(): string {
  const url = process.env.DATABASE_URL?.trim();
  if (!url) {
    console.error("DATABASE_URL is required (.env.local or env).");
    process.exit(1);
  }
  return url;
}

function hostLabel(url: string): string {
  try {
    return new URL(url).host;
  } catch {
    return "unknown-host";
  }
}

type BorrowerRow = {
  id: number;
  user_id: string;
  name: string;
};

type LoanRow = {
  id: number;
  loan_name: string;
  user_id: string;
};

async function main(): Promise<void> {
  const databaseUrl = loadDatabaseUrl();
  const isLocal = /(?:localhost|127\.0\.0\.1)/.test(databaseUrl);
  const isHosted = databaseUrl.includes("neon.tech");

  console.log(
    `${dryRun ? "Dry run" : "Apply"} on ${isLocal ? "local" : isHosted ? "hosted Neon" : "database"} (${hostLabel(databaseUrl)})`,
  );

  if (isHosted && !dryRun) {
    console.warn(
      "Writing to hosted Neon. This project has one branch, named production.",
    );
  }

  const sql = postgres(databaseUrl, { max: 1 });

  try {
    const borrowers = await sql<BorrowerRow[]>`
      SELECT id, user_id, name
      FROM borrowers
      WHERE lower(btrim(name)) = lower(${BORROWER_NAME})
      ORDER BY id
    `;

    if (borrowers.length === 0) {
      console.error(
        `No borrower named "${BORROWER_NAME}". Nothing was changed.`,
      );
      process.exit(1);
    }

    const byUser = new Map<string, BorrowerRow[]>();
    for (const borrower of borrowers) {
      const rows = byUser.get(borrower.user_id) ?? [];
      rows.push(borrower);
      byUser.set(borrower.user_id, rows);
    }

    let updated = 0;

    for (const [userId, rows] of byUser) {
      if (rows.length !== 1) {
        console.error(
          `Workspace ${userId} has ${rows.length} borrowers named "${BORROWER_NAME}". Skipped.`,
        );
        process.exit(1);
      }

      const borrower = rows[0];
      const matches = await sql<LoanRow[]>`
        SELECT l.id, l.loan_name, l.user_id
        FROM loans l
        WHERE l.user_id = ${userId}
          AND l.type = 'Lot Title'
          AND l.borrower_id IS NULL
          AND NOT EXISTS (
            SELECT 1 FROM loan_witnesses lw WHERE lw.loan_id = l.id
          )
          AND NOT EXISTS (
            SELECT 1
            FROM loan_signing_invitations si
            WHERE si.loan_id = l.id
              AND si.party_role IN ('witness_1', 'witness_2')
              AND (
                si.witness_id IS NOT NULL
                OR (
                  btrim(coalesce(si.party_name, '')) <> ''
                  AND lower(btrim(si.party_name)) NOT IN ('witness 1', 'witness 2')
                )
              )
          )
        ORDER BY l.id
      `;

      if (matches.length === 0) {
        console.log(
          `No matching loans for ${borrower.name} (id ${borrower.id}).`,
        );
        continue;
      }

      console.log(
        `${matches.length} loan(s) → ${borrower.name} (borrower id ${borrower.id})`,
      );
      for (const loan of matches) {
        console.log(`  ${loan.id}  ${loan.loan_name}`);
      }

      if (dryRun) {
        updated += matches.length;
        continue;
      }

      const written = await sql.begin(async (tx) => {
        return tx<LoanRow[]>`
          UPDATE loans AS l
          SET borrower_id = ${borrower.id},
              updated_at = now()
          WHERE l.user_id = ${userId}
            AND l.type = 'Lot Title'
            AND l.borrower_id IS NULL
            AND NOT EXISTS (
              SELECT 1 FROM loan_witnesses lw WHERE lw.loan_id = l.id
            )
            AND NOT EXISTS (
              SELECT 1
              FROM loan_signing_invitations si
              WHERE si.loan_id = l.id
                AND si.party_role IN ('witness_1', 'witness_2')
                AND (
                  si.witness_id IS NOT NULL
                  OR (
                    btrim(coalesce(si.party_name, '')) <> ''
                    AND lower(btrim(si.party_name)) NOT IN ('witness 1', 'witness 2')
                  )
                )
            )
          RETURNING l.id, l.loan_name, l.user_id
        `;
      });

      updated += written.length;
      console.log(`Updated ${written.length}.`);
    }

    console.log(
      dryRun ? `Would update ${updated}.` : `Done. Updated ${updated}.`,
    );
  } finally {
    await sql.end();
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
