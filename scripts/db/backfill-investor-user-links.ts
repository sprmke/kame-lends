/**
 * One-shot backfill: set investors.investor_user_id for workspace contacts that
 * belong to the same person as the workspace owner (email match, optional name).
 *
 * Usage:
 *   bun run db:backfill:investor-links --dry-run
 *   bun run db:backfill:investor-links --use-prod --dry-run
 *   bun run db:backfill:investor-links --include-name
 *   bun run db:backfill:investor-links --email=you@example.com
 *
 * Hosted Neon writes: prefer a backup first (`bun run backup:neon`). Dry-run is read-only.
 */
import postgres from "postgres";

const args = process.argv.slice(2);
const dryRun = args.includes("--dry-run");
const includeName = args.includes("--include-name");
const emailArg = args.find((a) => a.startsWith("--email="));
const emailFilter =
  emailArg?.slice("--email=".length).trim().toLowerCase() || null;

function loadDatabaseUrl(): string {
  const url = process.env.DATABASE_URL?.trim();
  if (!url) {
    console.error("DATABASE_URL is required (.env.local or env).");
    process.exit(1);
  }
  return url;
}

function assertTargetAllowed(url: string): void {
  const isLocal = /(?:localhost|127\.0\.0\.1)/.test(url);
  const isHosted = url.includes("neon.tech");

  if (isHosted && !dryRun) {
    console.warn(
      "WARN: writing to hosted Neon. Prefer a backup first (bun run backup:neon).",
    );
  }

  if (!isLocal && !isHosted) {
    console.warn(
      "WARN: DATABASE_URL is neither local nor neon.tech — proceed carefully.",
    );
  }
}

async function assertSchemaReady(
  sql: postgres.Sql,
  databaseUrl: string,
): Promise<void> {
  const isLocal = /(?:localhost|127\.0\.0\.1)/.test(databaseUrl);

  const tableCheck = await sql`
    SELECT EXISTS (
      SELECT 1
      FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = 'user'
    ) AS has_user,
    EXISTS (
      SELECT 1
      FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = 'investors'
    ) AS has_investors
  `;

  const { has_user, has_investors } = tableCheck[0] ?? {};
  if (has_user && has_investors) return;

  console.error("Database is missing Kame Lends schema (no auth user table).");
  if (isLocal) {
    console.error("");
    console.error("Local Docker is empty. Load data first, then re-run:");
    console.error("  bun run db:local:sync-prod");
    console.error("  bun run db:backfill:investor-links --dry-run");
    console.error("");
    console.error("Or preview against Neon prod (read-only dry-run):");
    console.error("  bun run db:backfill:investor-links --use-prod --dry-run");
  } else {
    console.error("Run migrations on this database before the backfill.");
  }
  process.exit(1);
}

async function main() {
  const databaseUrl = loadDatabaseUrl();
  assertTargetAllowed(databaseUrl);

  const sql = postgres(databaseUrl, { max: 1 });
  await assertSchemaReady(sql, databaseUrl);

  const authUsers = emailFilter
    ? await sql`
        SELECT id, email, name, role
        FROM "user"
        WHERE LOWER(TRIM(email)) = ${emailFilter}
      `
    : await sql`
        SELECT id, email, name, role
        FROM "user"
        WHERE email IS NOT NULL AND TRIM(email) != ''
      `;

  if (authUsers.length === 0) {
    console.log("No matching auth users found.");
    await sql.end();
    return;
  }

  let totalCandidates = 0;
  let totalUpdated = 0;

  for (const user of authUsers) {
    const userEmail = user.email?.trim().toLowerCase() ?? "";
    if (!userEmail) continue;

    const emailMatches = await sql`
      SELECT i.id, i.name, i.email, i.investor_user_id
      FROM investors i
      WHERE i.user_id = ${user.id}
        AND LOWER(TRIM(i.email)) = ${userEmail}
        AND i.investor_user_id IS DISTINCT FROM ${user.id}
      ORDER BY i.id
    `;

    let nameMatches: typeof emailMatches = [];
    if (includeName) {
      nameMatches = await sql`
        SELECT i.id, i.name, i.email, i.investor_user_id
        FROM investors i
        WHERE i.user_id = ${user.id}
          AND i.name ILIKE ${"%manlulu%"}
          AND i.investor_user_id IS DISTINCT FROM ${user.id}
          AND NOT (
            LOWER(TRIM(i.email)) = ${userEmail}
          )
        ORDER BY i.id
      `;
    }

    const byId = new Map<number, (typeof emailMatches)[0]>();
    for (const row of [...emailMatches, ...nameMatches]) {
      byId.set(row.id, row);
    }
    const candidates = [...byId.values()];
    if (candidates.length === 0) continue;

    const loanCounts = await sql`
      SELECT li.investor_id, COUNT(DISTINCT li.loan_id)::int AS loan_count
      FROM loan_investors li
      WHERE li.investor_id = ANY(${candidates.map((c) => c.id)})
      GROUP BY li.investor_id
    `;
    const loansByInvestor = new Map(
      loanCounts.map((row) => [row.investor_id, row.loan_count]),
    );

    console.log(
      `\n${user.email} (${user.name ?? "no name"}) — ${candidates.length} contact(s) to link`,
    );
    for (const row of candidates) {
      const loanCount = loansByInvestor.get(row.id) ?? 0;
      console.log(
        `  investor ${row.id} "${row.name}" <${row.email}> → ${loanCount} loan(s)`,
      );
    }

    totalCandidates += candidates.length;

    if (dryRun) continue;

    const ids = candidates.map((c) => c.id);
    const updated = await sql`
      UPDATE investors
      SET investor_user_id = ${user.id}, updated_at = NOW()
      WHERE id = ANY(${ids})
      RETURNING id
    `;
    totalUpdated += updated.length;
  }

  console.log(
    dryRun
      ? `\nDry run: ${totalCandidates} investor contact(s) would be linked.`
      : `\nLinked ${totalUpdated} investor contact(s). Restart the app to clear in-memory caches.`,
  );

  await sql.end();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
