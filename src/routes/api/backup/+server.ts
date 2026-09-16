import { json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { getSession } from "$lib/server/session";
import { backupFilename } from "$lib/brand";
import {
  fetchBackupDataForUser,
  fetchBackupDataForAllUsers,
  type BackupData,
} from "$lib/server/backup-data";
import { backupScopeAllAllowed } from "$lib/server/backup-access";

/**
 * GET /api/backup
 * Exports business data for the signed-in user, or all data owners when
 * scope=all and the caller is the platform owner email.
 */
export const GET: RequestHandler = async (event) => {
  const request = event.request;
  try {
    const session = await getSession(event);
    if (!session?.user?.id) {
      return json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const download = searchParams.get("download") === "true";
    const scopeAll = searchParams.get("scope") === "all";

    if (!backupScopeAllAllowed(scopeAll, session.user.email)) {
      return json({ error: "Forbidden" }, { status: 403 });
    }

    const backupData:
      BackupData | Awaited<ReturnType<typeof fetchBackupDataForAllUsers>> =
      scopeAll
        ? await fetchBackupDataForAllUsers({
            exportedByLabel:
              session.user.email || session.user.name || session.user.id,
          })
        : await fetchBackupDataForUser({
            userId: session.user.id,
            exportedByLabel:
              session.user.email || session.user.name || session.user.id,
          });

    if (download) {
      const filename = scopeAll
        ? backupFilename(new Date()).replace(".json", "-all-users.json")
        : backupFilename(new Date());

      return new Response(JSON.stringify(backupData, null, 2), {
        status: 200,
        headers: {
          "Content-Type": "application/json",
          "Content-Disposition": `attachment; filename="${filename}"`,
        },
      });
    }

    return json(backupData);
  } catch (error) {
    console.error("Error creating backup:", error);
    return json({ error: "Failed to create backup" }, { status: 500 });
  }
};
