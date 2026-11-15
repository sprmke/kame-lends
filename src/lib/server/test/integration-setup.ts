/**
 * Guard rails for database integration tests.
 *
 * Refuses to run against anything that is not local Postgres. A test run must
 * never touch production, QA, or a Neon branch.
 */
import { beforeAll } from "vitest";
import { parse } from "dotenv";
import { readFileSync } from "node:fs";

function localEnvUrl(): string {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;
  try {
    return parse(readFileSync(".env.local", "utf8")).DATABASE_URL ?? "";
  } catch {
    return "";
  }
}

function assertLocalDatabase(): void {
  const url = localEnvUrl();
  const isLocal = /(?:localhost|127\.0\.0\.1)/.test(url);
  if (!isLocal || url.includes("neon.tech")) {
    throw new Error(
      `Integration tests need local Postgres on 127.0.0.1:5433. Refusing to run against: ${url.split("@").at(-1) ?? "(unset)"}`,
    );
  }
}

beforeAll(() => {
  assertLocalDatabase();
});
