import { describe, expect, it } from "vitest";
import {
  assertStorageRef,
  buildStorageRefForKey,
  canReadStorageRef,
  uploadOwnerUserId,
} from "./access";

describe("storage access", () => {
  it("reads the upload owner from a key", () => {
    expect(uploadOwnerUserId("uploads/user-123/loan/receipt.png")).toBe(
      "user-123",
    );
    expect(uploadOwnerUserId("receipts/user-123/file.png")).toBeNull();
  });

  it("builds a storage ref and rejects invalid refs", () => {
    const ref = buildStorageRefForKey("uploads/user-123/file.png");
    expect(ref.startsWith("storage:")).toBe(true);
    expect(assertStorageRef(ref)).toBe("uploads/user-123/file.png");
    expect(() => assertStorageRef("data:image/png;base64,abc")).toThrow();
    expect(() => assertStorageRef("")).toThrow();
  });

  it("denies an invalid reference without querying a loan", async () => {
    await expect(canReadStorageRef("user-1", "not-a-ref")).resolves.toBe(false);
  });
});
