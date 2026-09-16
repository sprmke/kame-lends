/** Shared Channels status copy. Row already names Calendar / Telegram. */

export const CHANNEL_STATUS = {
  notConnected: "Not connected",
  settingUp: "Setting up",
  connected: "Connected",
  needsAttention: "Needs attention",
} as const;

export type ChannelKind = "calendar" | "telegram";

export function groupChannelStatusLabel(
  kind: ChannelKind,
  status: string | null | undefined,
): string {
  if (kind === "calendar") {
    if (status === "active") return CHANNEL_STATUS.connected;
    if (status === "provisioning") return CHANNEL_STATUS.settingUp;
    if (status === "error") return CHANNEL_STATUS.needsAttention;
    return CHANNEL_STATUS.notConnected;
  }
  if (status === "connected") return CHANNEL_STATUS.connected;
  if (status === "bot_removed") return CHANNEL_STATUS.needsAttention;
  return CHANNEL_STATUS.notConnected;
}

export function groupChannelStatusA11y(
  kind: ChannelKind,
  status: string | null | undefined,
): string {
  const name = kind === "calendar" ? "Calendar" : "Telegram";
  return `${name}: ${groupChannelStatusLabel(kind, status)}`;
}
