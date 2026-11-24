import { describe, expect, it } from "vitest";
import { applyApiCacheHeaders, applySecurityHeaders } from "./security-headers";

describe("security headers", () => {
  it("allows the microphone for this origin only (voice input)", () => {
    const headers = new Headers();
    applySecurityHeaders(headers);
    expect(headers.get("Permissions-Policy")).toBe(
      "camera=(), microphone=(self), geolocation=()",
    );
  });

  it("keeps API responses private and uncached", () => {
    const headers = new Headers();
    applyApiCacheHeaders(headers);
    expect(headers.get("Cache-Control")).toBe("private, no-store");
  });
});
