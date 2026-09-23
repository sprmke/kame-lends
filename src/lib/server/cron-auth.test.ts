import { describe, expect, it, vi } from "vitest";

vi.mock("$env/dynamic/private", () => ({
  env: { CRON_SECRET: "test-cron-secret" },
}));

const { isCronAuthorized } = await import("./cron-auth");

describe("isCronAuthorized", () => {
  it("accepts the matching bearer token", () => {
    const request = new Request("https://example.test/api/cron/backup", {
      headers: { authorization: "Bearer test-cron-secret" },
    });
    expect(isCronAuthorized(request)).toBe(true);
  });

  it("rejects a missing header", () => {
    const request = new Request("https://example.test/api/cron/backup");
    expect(isCronAuthorized(request)).toBe(false);
  });

  it("rejects a wrong bearer token", () => {
    const request = new Request("https://example.test/api/cron/backup", {
      headers: { authorization: "Bearer other-secret" },
    });
    expect(isCronAuthorized(request)).toBe(false);
  });
});
