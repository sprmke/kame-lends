import { json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { getMigrationStatus } from "$lib/server/migration-status";

/** Public readiness probe for CD smoke tests and ops. No auth. */
export const GET: RequestHandler = async () => {
  const migrations = await getMigrationStatus();
  const status = migrations.ok ? 200 : 503;

  return json(
    {
      ok: migrations.ok,
      db: migrations.dbConnected ? "connected" : "unavailable",
      migrations: {
        pending: migrations.pendingCount,
        pendingFiles: migrations.pendingFiles,
        latestApplied: migrations.latestApplied,
        missingColumns: migrations.missingColumns,
      },
    },
    { status },
  );
};
