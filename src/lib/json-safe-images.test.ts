import { describe, expect, it } from "vitest";
import { jsonSafeImageRef, stripDataImageUrls } from "./json-safe-images";

const JPEG = "data:image/jpeg;base64,/9j/aaaa";
const REF = "storage:uploads/user/id.jpg";

describe("jsonSafeImageRef", () => {
  it("keeps storage refs and drops data URLs", () => {
    expect(jsonSafeImageRef(REF)).toBe(REF);
    expect(jsonSafeImageRef(JPEG)).toBeNull();
    expect(jsonSafeImageRef("")).toBeNull();
    expect(jsonSafeImageRef(null)).toBeNull();
  });
});

describe("stripDataImageUrls", () => {
  it("nulls nested data URLs and keeps storage refs", () => {
    const dueDate = new Date("2026-09-01T00:00:00.000Z");
    const result = stripDataImageUrls({
      name: "Ada",
      dueDate,
      validIdUrl: JPEG,
      eSignatureUrl: REF,
      nested: [{ receiptImageUrl: JPEG, amount: "10" }],
    });
    expect(result).toEqual({
      name: "Ada",
      dueDate,
      validIdUrl: null,
      eSignatureUrl: REF,
      nested: [{ receiptImageUrl: null, amount: "10" }],
    });
    expect(result.dueDate).toBe(dueDate);
  });
});
