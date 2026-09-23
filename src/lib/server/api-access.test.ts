import { describe, expect, it } from "vitest";
import {
  isPublicApiPath,
  requiresApiSession,
  requiresOriginCheck,
} from "./api-access";

describe("api-access", () => {
  it("allows the public inventory", () => {
    expect(isPublicApiPath("/api/health")).toBe(true);
    expect(isPublicApiPath("/api/pwa/version")).toBe(true);
    expect(isPublicApiPath("/api/cron/backup")).toBe(true);
    expect(isPublicApiPath("/api/webhooks/telegram")).toBe(true);
    expect(isPublicApiPath("/api/sign/abc")).toBe(true);
    expect(isPublicApiPath("/api/e2e/session")).toBe(true);
  });

  it("requires a session for business APIs", () => {
    expect(requiresApiSession("/api/loans")).toBe(true);
    expect(requiresApiSession("/api/backup")).toBe(true);
    expect(requiresApiSession("/api/export/loans")).toBe(true);
    expect(requiresApiSession("/api/health")).toBe(false);
  });

  it("origin-checks mutating session APIs only", () => {
    expect(requiresOriginCheck("POST", "/api/loans")).toBe(true);
    expect(requiresOriginCheck("GET", "/api/loans")).toBe(false);
    expect(requiresOriginCheck("POST", "/api/sign/token")).toBe(false);
    expect(requiresOriginCheck("POST", "/api/cron/backup")).toBe(false);
  });
});
