import { describe, expect, it } from "vitest";
import { resolveErrorPresentation } from "./error-presentation";

describe("resolveErrorPresentation", () => {
  it("explains a signing route the account cannot sign", () => {
    const result = resolveErrorPresentation({
      status: 403,
      pathname: "/loans/88/sign",
      signedIn: true,
    });

    expect(result.icon).toBe("denied");
    expect(result.title).toBe("You can't sign this contract");
    // A signing 403 means the loan is viewable but has no slot for this account.
    expect(result.actions[0]).toMatchObject({
      label: "View loan",
      href: "/loans/88",
    });
    expect(result.actions[1]).toMatchObject({ label: "Dashboard" });
  });

  it("covers both missing and no-access loans without leaking which one it is", () => {
    const result = resolveErrorPresentation({
      status: 404,
      pathname: "/loans/88/sign",
      signedIn: true,
    });

    expect(result.title).toBe("Contract not available");
    expect(result.detail).toContain("doesn't have access");
  });

  it("offers the read-only view when only editing is blocked", () => {
    const result = resolveErrorPresentation({
      status: 403,
      pathname: "/loans/88",
      search: "?edit=1",
      signedIn: true,
    });

    expect(result.title).toBe("View only access");
    expect(result.actions[0]).toMatchObject({
      label: "View loan",
      href: "/loans/88",
    });
  });

  it("names the entity on other detail routes", () => {
    expect(
      resolveErrorPresentation({
        status: 404,
        pathname: "/investors/12",
        signedIn: true,
      }).title,
    ).toBe("Investor not available");

    expect(
      resolveErrorPresentation({
        status: 404,
        pathname: "/transactions/12",
        signedIn: true,
      }).title,
    ).toBe("Transaction not available");
  });

  it("treats an emailed signing link as expired or reused", () => {
    const result = resolveErrorPresentation({
      status: 404,
      pathname: "/sign/abc123",
      signedIn: false,
    });

    expect(result.title).toBe("Signing link not found");
    expect(result.actions[0]).toMatchObject({
      label: "Sign in",
      href: "/signin",
    });
  });

  it("returns to the blocked page after signing in again", () => {
    const result = resolveErrorPresentation({
      status: 401,
      pathname: "/loans/88/sign",
      search: "?role=witness",
      signedIn: false,
    });

    expect(result.actions[0].href).toBe(
      "/signin?callbackUrl=%2Floans%2F88%2Fsign%3Frole%3Dwitness",
    );
  });

  it("offers a retry on server failures", () => {
    const result = resolveErrorPresentation({
      status: 500,
      pathname: "/loans/88",
      signedIn: true,
    });

    expect(result.icon).toBe("crash");
    expect(result.actions[0]).toMatchObject({
      label: "Try again",
      kind: "reload",
    });
  });

  it("falls back to page copy on unknown routes", () => {
    const result = resolveErrorPresentation({
      status: 404,
      pathname: "/does-not-exist",
      signedIn: true,
    });

    expect(result.title).toBe("Page not found");
  });

  it("does not treat create routes as detail routes", () => {
    expect(
      resolveErrorPresentation({
        status: 404,
        pathname: "/loans/new",
        signedIn: true,
      }).title,
    ).toBe("Page not found");
  });
});
