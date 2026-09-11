import { describe, expect, it } from "vitest";
import {
  WORKSPACE_OWNER_EMAIL,
  isWorkspaceOwnerEmail,
  normalizeStoredUserRole,
} from "$lib/server/workspace-owner";

describe("workspace-owner", () => {
  it("recognizes the sitewide owner email", () => {
    expect(isWorkspaceOwnerEmail(WORKSPACE_OWNER_EMAIL)).toBe(true);
    expect(isWorkspaceOwnerEmail("MICHAELDMANLULU@GMAIL.COM")).toBe(true);
  });

  it("rejects non-owner emails", () => {
    expect(isWorkspaceOwnerEmail("bacaniromina@gmail.com")).toBe(false);
  });

  it("keeps admin only for the workspace owner", () => {
    expect(normalizeStoredUserRole("admin", WORKSPACE_OWNER_EMAIL)).toBe(
      "admin",
    );
    expect(normalizeStoredUserRole("admin", "party@example.com")).toBeNull();
    expect(normalizeStoredUserRole("borrower", "party@example.com")).toBe(
      "borrower",
    );
    expect(normalizeStoredUserRole(null, "party@example.com")).toBeNull();
  });
});
