import { env } from "$env/dynamic/private";

export type NeonTransferSnapshot = {
  projectId: string;
  dataTransferBytes: number;
  alertBytes: number;
  overAlert: boolean;
  source: "project_details";
};

function readEnv(name: string): string | undefined {
  const value = env[name] ?? process.env[name];
  return value && value.trim().length > 0 ? value.trim() : undefined;
}

/** Default early warning for a few-user app (10 GB). Override with NEON_TRANSFER_ALERT_BYTES. */
export const DEFAULT_NEON_TRANSFER_ALERT_BYTES = 10 * 1024 * 1024 * 1024;

export function resolveNeonTransferAlertBytes(): number {
  const raw = readEnv("NEON_TRANSFER_ALERT_BYTES");
  if (!raw) return DEFAULT_NEON_TRANSFER_ALERT_BYTES;
  const parsed = Number(raw);
  return Number.isFinite(parsed) && parsed > 0
    ? parsed
    : DEFAULT_NEON_TRANSFER_ALERT_BYTES;
}

/**
 * Current billing-period public network transfer from Neon project details.
 * Does not wake compute. Requires NEON_API_KEY + NEON_PROJECT_ID.
 */
export async function fetchNeonTransferSnapshot(): Promise<NeonTransferSnapshot | null> {
  const apiKey = readEnv("NEON_API_KEY");
  const projectId = readEnv("NEON_PROJECT_ID");
  if (!apiKey || !projectId) return null;

  const response = await fetch(
    `https://console.neon.tech/api/v2/projects/${encodeURIComponent(projectId)}`,
    {
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
    },
  );
  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(
      `Neon project details failed (${response.status}): ${body.slice(0, 200)}`,
    );
  }

  const payload = (await response.json()) as {
    project?: { data_transfer_bytes?: number | string };
  };
  const raw = payload.project?.data_transfer_bytes ?? 0;
  const dataTransferBytes =
    typeof raw === "number" ? raw : Number.parseInt(String(raw), 10) || 0;
  const alertBytes = resolveNeonTransferAlertBytes();

  return {
    projectId,
    dataTransferBytes,
    alertBytes,
    overAlert: dataTransferBytes >= alertBytes,
    source: "project_details",
  };
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  const units = ["KB", "MB", "GB", "TB"];
  let value = bytes / 1024;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit += 1;
  }
  return `${value.toFixed(2)} ${units[unit]}`;
}
