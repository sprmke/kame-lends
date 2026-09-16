import { isWorkspaceOwnerEmail } from "$lib/server/workspace-owner";

/** Gate for `GET /api/backup?scope=all`. */
export function backupScopeAllAllowed(
  scopeAll: boolean,
  email: string | null | undefined,
): boolean {
  if (!scopeAll) return true;
  return isWorkspaceOwnerEmail(email);
}
