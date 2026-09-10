import { describe, expect, it } from "vitest";
import { isPlaceholderDatabaseUrl } from "./index";

describe("isPlaceholderDatabaseUrl", () => {
  it("flags an .env.example host", () => {
    expect(
      isPlaceholderDatabaseUrl(
        "postgresql://neondb_owner:...@ep-....us-east-1.aws.neon.tech/...",
      ),
    ).toBe(true);
  });

  it("flags an angle-bracket template", () => {
    expect(
      isPlaceholderDatabaseUrl("postgresql://user:<password>@host/db"),
    ).toBe(true);
  });

  it("flags an empty value", () => {
    expect(isPlaceholderDatabaseUrl(undefined)).toBe(true);
  });

  it("accepts a real local URL", () => {
    expect(
      isPlaceholderDatabaseUrl(
        "postgresql://kame_lends:kame_lends@127.0.0.1:5433/kame_lends",
      ),
    ).toBe(false);
  });

  it("accepts a real Neon URL", () => {
    expect(
      isPlaceholderDatabaseUrl(
        "postgresql://neondb_owner:secret@ep-rapid-shape-b3d6tnw9-pooler.c-4.ap-southeast-1.aws.neon.tech/neondb?sslmode=require",
      ),
    ).toBe(false);
  });
});
