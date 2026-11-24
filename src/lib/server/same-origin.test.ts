import { describe, expect, it } from "vitest";
import { isSameOriginRequest } from "./same-origin";

const url = new URL("https://app.example.com/api/ai/assistant");

function request(origin?: string) {
  return new Request(url, {
    method: "POST",
    headers: origin ? { origin } : {},
  });
}

describe("isSameOriginRequest", () => {
  it("allows a matching origin", () => {
    expect(isSameOriginRequest(request("https://app.example.com"), url)).toBe(
      true,
    );
  });

  it("allows a non-browser request with no Origin header", () => {
    expect(isSameOriginRequest(request(), url)).toBe(true);
  });

  it("rejects a different origin", () => {
    expect(isSameOriginRequest(request("https://evil.example"), url)).toBe(
      false,
    );
  });

  it("rejects a sandboxed null origin", () => {
    expect(isSameOriginRequest(request("null"), url)).toBe(false);
  });

  it("rejects a malformed origin", () => {
    expect(isSameOriginRequest(request("not a url"), url)).toBe(false);
  });
});
