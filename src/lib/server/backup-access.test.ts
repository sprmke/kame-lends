import { describe, expect, it } from "vitest";
import { backupScopeAllAllowed } from "$lib/server/backup-access";
import { WORKSPACE_OWNER_EMAIL } from "$lib/server/workspace-owner";

describe("backupScopeAllAllowed", () => {
  it("allows per-user export for any signed-in email", () => {
    expect(backupScopeAllAllowed(false, "party@example.com")).toBe(true);
  });

  it("allows scope=all only for platform owner", () => {
    expect(backupScopeAllAllowed(true, WORKSPACE_OWNER_EMAIL)).toBe(true);
    expect(backupScopeAllAllowed(true, "party@example.com")).toBe(false);
  });
});
