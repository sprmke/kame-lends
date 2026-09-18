import { describe, expect, it } from "vitest";
import { isOfflineMutationResponse } from "$lib/pwa/offline-fetch";
import { OFFLINE_ERROR_MESSAGE } from "$lib/pwa/shared";

describe("isOfflineMutationResponse", () => {
  it("detects the service worker offline JSON body", () => {
    expect(
      isOfflineMutationResponse(503, { error: OFFLINE_ERROR_MESSAGE }),
    ).toBe(true);
  });

  it("ignores other 503 payloads", () => {
    expect(isOfflineMutationResponse(503, { error: "Server busy" })).toBe(
      false,
    );
    expect(
      isOfflineMutationResponse(500, { error: OFFLINE_ERROR_MESSAGE }),
    ).toBe(false);
  });
});
