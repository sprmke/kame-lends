import { describe, expect, it } from "vitest";
import {
  imagePreviewSrc,
  isStorageRef,
  normalizeStoredImageRef,
  parseStorageKey,
  toStorageRef,
} from "./storage-reference";

const JPEG =
  "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/2wBDAQkJCQwLDBgNDRgyIRwhMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjL/wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAv/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFQEBAQAAAAAAAAAAAAAAAAAAAAX/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIRAxEAPwCwAA8A/9k=";

describe("storage-reference", () => {
  it("round-trips storage refs", () => {
    const key = "uploads/user-1/abc.jpg";
    const ref = toStorageRef(key);
    expect(isStorageRef(ref)).toBe(true);
    expect(parseStorageKey(ref)).toBe(key);
  });

  it("rejects traversal in storage refs", () => {
    expect(parseStorageKey("storage:uploads/../secret")).toBeNull();
  });

  it("accepts legacy data URLs and storage refs", () => {
    const ref = toStorageRef("uploads/u/file.jpg");
    expect(normalizeStoredImageRef(JPEG, 1_000_000)).toBe(JPEG);
    expect(normalizeStoredImageRef(ref, 1_000_000)).toBe(ref);
    expect(
      normalizeStoredImageRef("https://example.com/x.jpg", 1_000_000),
    ).toBeNull();
  });

  it("maps storage refs to the authenticated object route", () => {
    const ref = toStorageRef("uploads/u/file.jpg");
    expect(imagePreviewSrc(ref)).toBe(
      `/api/storage/object?ref=${encodeURIComponent(ref)}`,
    );
    expect(imagePreviewSrc(JPEG)).toBe(JPEG);
  });
});
