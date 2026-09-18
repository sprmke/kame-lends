import { describe, expect, it } from "vitest";
import { pushDeliveryAction } from "$lib/server/push/status";

describe("pushDeliveryAction", () => {
  it("maps status codes to actions", () => {
    expect(pushDeliveryAction(200)).toBe("sent");
    expect(pushDeliveryAction(410)).toBe("prune");
    expect(pushDeliveryAction(429)).toBe("retry");
    expect(pushDeliveryAction(400)).toBe("failed");
  });
});
