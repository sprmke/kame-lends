import { describe, expect, it } from "vitest";
import { parseStorageKey } from "$lib/storage-reference";
import { uploadOwnerUserId } from "./access";

describe("storage access helpers", () => {
  it("rejects path traversal in storage refs", () => {
    expect(parseStorageKey("storage:uploads/../secret")).toBeNull();
    expect(parseStorageKey("storage:uploads/user-a/file.jpg")).toBe(
      "uploads/user-a/file.jpg",
    );
  });

  it("only treats the upload prefix owner as the object owner", () => {
    expect(uploadOwnerUserId("uploads/user-a/file.jpg")).toBe("user-a");
    expect(uploadOwnerUserId("uploads/user-a/file.jpg") === "user-b").toBe(
      false,
    );
    expect(uploadOwnerUserId("other/user-a/file.jpg")).toBeNull();
  });
});
