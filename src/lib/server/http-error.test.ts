import { afterEach, describe, expect, it } from "vitest";
import { publicJsonError } from "./http-error";

describe("publicJsonError", () => {
  const previousVercel = process.env.VERCEL_ENV;
  const previousNode = process.env.NODE_ENV;

  afterEach(() => {
    process.env.VERCEL_ENV = previousVercel;
    process.env.NODE_ENV = previousNode;
  });

  it("omits details in production", () => {
    process.env.VERCEL_ENV = "production";
    expect(publicJsonError("Failed", new Error("secret table"))).toEqual({
      error: "Failed",
    });
  });

  it("includes details outside production", () => {
    process.env.VERCEL_ENV = "development";
    process.env.NODE_ENV = "test";
    expect(publicJsonError("Failed", new Error("column missing"))).toEqual({
      error: "Failed",
      details: "column missing",
    });
  });
});
