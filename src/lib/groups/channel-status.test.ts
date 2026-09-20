import { describe, expect, it } from "vitest";
import {
  CHANNEL_STATUS,
  groupChannelStatusA11y,
  groupChannelStatusLabel,
} from "./channel-status";

describe("groupChannelStatusLabel", () => {
  it("uses the same words for calendar and telegram", () => {
    expect(groupChannelStatusLabel("calendar", undefined)).toBe(
      CHANNEL_STATUS.notConnected,
    );
    expect(groupChannelStatusLabel("telegram", "disconnected")).toBe(
      CHANNEL_STATUS.notConnected,
    );
    expect(groupChannelStatusLabel("calendar", "provisioning")).toBe(
      CHANNEL_STATUS.notSetUp,
    );
    expect(groupChannelStatusLabel("calendar", "active")).toBe(
      CHANNEL_STATUS.connected,
    );
    expect(groupChannelStatusLabel("telegram", "connected")).toBe(
      CHANNEL_STATUS.connected,
    );
    expect(groupChannelStatusLabel("calendar", "error")).toBe(
      CHANNEL_STATUS.needsAttention,
    );
    expect(groupChannelStatusLabel("telegram", "bot_removed")).toBe(
      CHANNEL_STATUS.needsAttention,
    );
  });

  it("prefixes the channel name for icon-only labels", () => {
    expect(groupChannelStatusA11y("calendar", "provisioning")).toBe(
      "Calendar: Not set up",
    );
    expect(groupChannelStatusA11y("telegram", null)).toBe(
      "Telegram: Not connected",
    );
  });
});
