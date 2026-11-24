import { json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { getMigrationStatus } from "$lib/server/migration-status";
import { isAiConfigured, isAssistantConfigured } from "$lib/server/ai/config";

/** Public readiness probe for CD smoke tests and ops. No auth, no secrets. */
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
      ai: {
        configured: isAiConfigured(),
        assistantConfigured: isAssistantConfigured(),
      },
    },
    { status },
  );
};
