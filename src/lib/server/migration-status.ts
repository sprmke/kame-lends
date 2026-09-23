import { readdirSync } from "node:fs";
import { join } from "node:path";
import { sql } from "drizzle-orm";
import { db } from "$lib/server/db";

const MIGRATIONS_DIR = join(process.cwd(), "db/migrations");

export type MigrationStatus = {
  ok: boolean;
  dbConnected: boolean;
  pendingCount: number;
  pendingFiles: string[];
  latestApplied: string | null;
  missingColumns: string[];
};

function listMigrationFiles(): string[] {
  return readdirSync(MIGRATIONS_DIR)
    .filter((name) => name.endsWith(".sql"))
    .sort();
}

function queryRows<T>(result: { rows: T[] } | T[]): T[] {
  return Array.isArray(result) ? result : result.rows;
}

async function columnExists(table: string, column: string): Promise<boolean> {
  const result = await db.execute<{ exists: boolean }>(sql`
    SELECT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = ${table}
        AND column_name = ${column}
    ) AS exists
  `);
  return Boolean(queryRows(result)[0]?.exists);
}

export async function getMigrationStatus(): Promise<MigrationStatus> {
  const onDisk = listMigrationFiles();
  let applied: string[] = [];
  const missingColumns: string[] = [];
  let dbConnected: boolean;

  try {
    const rows = await db.execute<{ filename: string }>(
      sql`SELECT filename FROM schema_migrations ORDER BY filename`,
    );
    applied = queryRows(rows).map((row) => row.filename);

    const requiredColumns: Array<[string, string]> = [
      ["loan_investors", "profit_type"],
      ["loan_investors", "profit_value"],
      ["loan_groups", "id"],
      ["push_subscriptions", "endpoint"],
      ["loan_user_commissions", "loan_id"],
      ["rate_limit_buckets", "key"],
    ];
    for (const [table, column] of requiredColumns) {
      if (!(await columnExists(table, column))) {
        missingColumns.push(`${table}.${column}`);
      }
    }
    dbConnected = true;
  } catch {
    dbConnected = false;
  }

  const appliedSet = new Set(applied);
  const pendingFiles = onDisk.filter((file) => !appliedSet.has(file));
  const latestApplied =
    applied.length > 0 ? applied[applied.length - 1]! : null;
  const ok =
    dbConnected && pendingFiles.length === 0 && missingColumns.length === 0;

  return {
    ok,
    dbConnected,
    pendingCount: pendingFiles.length,
    pendingFiles,
    latestApplied,
    missingColumns,
  };
}
