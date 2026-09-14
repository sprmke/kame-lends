import { describe, expect, it } from "vitest";
import {
  formatGoogleCalendarApiError,
  isGoogleCalendarRateLimitError,
  readGoogleCalendarConfig,
  withGoogleCalendarRetry,
} from "./google-calendar-config";

describe("readGoogleCalendarConfig", () => {
  const privateKey =
    "-----BEGIN PRIVATE KEY-----\\nABC\\n-----END PRIVATE KEY-----\\n";

  it("returns null when the service account email is missing", () => {
    expect(
      readGoogleCalendarConfig({
        GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY: privateKey,
        GOOGLE_CALENDAR_ID: "test@group.calendar.google.com",
      }),
    ).toBeNull();
  });

  it("returns null when calendar id is missing instead of using primary", () => {
    expect(
      readGoogleCalendarConfig({
        GOOGLE_SERVICE_ACCOUNT_EMAIL: "sa@project.iam.gserviceaccount.com",
        GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY: privateKey,
      }),
    ).toBeNull();
  });

  it("unescapes private key newlines and keeps the calendar id", () => {
    const config = readGoogleCalendarConfig({
      GOOGLE_SERVICE_ACCOUNT_EMAIL: "sa@project.iam.gserviceaccount.com",
      GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY: privateKey,
      GOOGLE_CALENDAR_ID: "test@group.calendar.google.com",
    });

    expect(config).not.toBeNull();
    expect(config?.privateKey).toContain("\nABC\n");
    expect(config?.calendarId).toBe("test@group.calendar.google.com");
  });
});

describe("formatGoogleCalendarApiError", () => {
  it("formats invalid_grant account not found", () => {
    expect(
      formatGoogleCalendarApiError({
        message: "invalid_grant: Invalid grant: account not found",
        response: {
          data: {
            error: "invalid_grant",
            error_description: "Invalid grant: account not found",
          },
        },
      }),
    ).toMatch(/account not found/i);
  });

  it("formats calendar not found", () => {
    expect(
      formatGoogleCalendarApiError({
        message: "Not Found",
        code: 404,
        errors: [{ message: "Not Found", reason: "notFound" }],
        response: {
          data: {
            error: {
              message: "Not Found",
              errors: [{ message: "Not Found", reason: "notFound" }],
            },
          },
        },
      }),
    ).toMatch(/notFound/i);
  });
});

describe("isGoogleCalendarRateLimitError", () => {
  it("detects the formatted rateLimitExceeded payload from sync", () => {
    expect(
      isGoogleCalendarRateLimitError(
        new Error(
          "Rate Limit Exceeded (rateLimitExceeded: Rate Limit Exceeded)",
        ),
      ),
    ).toBe(true);
  });

  it("does not treat invalid_grant as a rate limit", () => {
    expect(
      isGoogleCalendarRateLimitError(
        new Error("invalid_grant: Invalid grant: account not found"),
      ),
    ).toBe(false);
  });
});

describe("withGoogleCalendarRetry", () => {
  it("retries rate limits then succeeds", async () => {
    let calls = 0;
    const delays: number[] = [];
    const result = await withGoogleCalendarRetry(
      async () => {
        calls += 1;
        if (calls < 3) {
          throw {
            message: "Rate Limit Exceeded",
            errors: [
              { reason: "rateLimitExceeded", message: "Rate Limit Exceeded" },
            ],
          };
        }
        return "ok";
      },
      {
        baseDelayMs: 10,
        sleep: async (ms) => {
          delays.push(ms);
        },
      },
    );

    expect(result).toBe("ok");
    expect(calls).toBe(3);
    expect(delays).toEqual([10, 20]);
  });

  it("does not retry account not found", async () => {
    let calls = 0;
    await expect(
      withGoogleCalendarRetry(
        async () => {
          calls += 1;
          throw new Error("invalid_grant: Invalid grant: account not found");
        },
        { sleep: async () => {} },
      ),
    ).rejects.toThrow(/account not found/);
    expect(calls).toBe(1);
  });
});
