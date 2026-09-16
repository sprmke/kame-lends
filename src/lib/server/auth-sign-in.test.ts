import { describe, expect, it } from "vitest";
import { isGoogleSignInAllowed, signInErrorMessage } from "./auth-sign-in";

describe("isGoogleSignInAllowed", () => {
  it("allows any normalized Google email", () => {
    expect(
      isGoogleSignInAllowed({
        email: "investor@example.com",
        existingUser: true,
        workspaceHasUsers: true,
      }),
    ).toBe(true);
    expect(
      isGoogleSignInAllowed({
        email: "stranger@example.com",
        existingUser: false,
        workspaceHasUsers: true,
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
      "Sign-in is not allowed for this Google account.",
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
