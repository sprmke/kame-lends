import { describe, expect, it } from "vitest";
import { isGoogleSignInAllowed, signInErrorMessage } from "./auth-sign-in";

describe("isGoogleSignInAllowed", () => {
  it("allows an existing workspace email", () => {
    expect(
      isGoogleSignInAllowed({
        email: "investor@example.com",
        existingUser: true,
        workspaceHasUsers: true,
      }),
    ).toBe(true);
  });

  it("rejects an unknown email when users already exist", () => {
    expect(
      isGoogleSignInAllowed({
        email: "stranger@example.com",
        existingUser: false,
        workspaceHasUsers: true,
      }),
    ).toBe(false);
  });

  it("allows the first Google user on an empty workspace", () => {
    expect(
      isGoogleSignInAllowed({
        email: "owner@example.com",
        existingUser: false,
        workspaceHasUsers: false,
      }),
    ).toBe(true);
  });

  it("rejects a missing email", () => {
    expect(
      isGoogleSignInAllowed({
        email: "   ",
        existingUser: false,
        workspaceHasUsers: false,
      }),
    ).toBe(false);
  });
});

describe("signInErrorMessage", () => {
  it("explains AccessDenied", () => {
    expect(signInErrorMessage("AccessDenied")).toBe(
      "This Google account is not on the workspace.",
    );
  });

  it("uses a short fallback for adapter failures", () => {
    expect(signInErrorMessage("Configuration")).toBe(
      "Sign-in failed. Try again.",
    );
  });

  it("returns null when Auth.js did not send an error", () => {
    expect(signInErrorMessage(null)).toBeNull();
  });
});
