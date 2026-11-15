import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Log hygiene (T11.4). Request bodies, receipts, emails, and account numbers
 * must never reach a console call or Sentry. A source scan is crude but catches
 * the mistake before it ships.
 */
const ROOTS = ["src"];
const SUSPICIOUS = [
  /console\.[a-z]+\([^)]*request\.json\(/i,
  /console\.[a-z]+\([^)]*\bbody\b/i,
  /console\.[a-z]+\([^)]*receipts?\b/i,
  /console\.[a-z]+\([^)]*receiptImageUrl/i,
  /console\.[a-z]+\([^)]*accountNumber/i,
];

function files(root: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(root)) {
    const path = join(root, entry);
    if (statSync(path).isDirectory()) out.push(...files(path));
    else if (/\.(ts|svelte)$/.test(entry) && !entry.endsWith(".test.ts"))
      out.push(path);
  }
  return out;
}

describe("log hygiene", () => {
  it("does not log request bodies, receipts, or account numbers", () => {
    const violations: string[] = [];
    for (const file of ROOTS.flatMap(files)) {
      const source = readFileSync(file, "utf8");
      for (const pattern of SUSPICIOUS) {
        if (pattern.test(source)) violations.push(`${file}: ${pattern}`);
      }
    }
    expect(violations).toEqual([]);
  });
});
