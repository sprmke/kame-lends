import { readFileSync, statSync } from "node:fs";
import { describe, expect, it } from "vitest";

/**
 * Route inventory (T11.1).
 *
 * Every mutating **money** route must parse its body with a schema in
 * `src/lib/schemas/`. Debt routes are listed as known gaps until they are
 * migrated; a new route cannot join the gap list silently.
 */
const MONEY_ROUTES = [
  "src/routes/api/loans/+server.ts",
  "src/routes/api/loans/[id]/+server.ts",
  "src/routes/api/loans/[id]/payments/+server.ts",
  "src/routes/api/loans/[id]/pay-transaction/+server.ts",
  "src/routes/api/loans/[id]/received-payments/+server.ts",
  "src/routes/api/loans/[id]/status/+server.ts",
  "src/routes/api/received-payments/[id]/+server.ts",
  "src/routes/api/interest-periods/[id]/+server.ts",
  "src/routes/api/interest-periods/[id]/consolidate-payment/+server.ts",
  "src/routes/api/debts/+server.ts",
  "src/routes/api/debts/[id]/+server.ts",
  "src/routes/api/debt-received-payments/[id]/+server.ts",
  "src/routes/api/debt-interest-periods/[id]/+server.ts",
  "src/routes/api/debt-interest-periods/[id]/consolidate-payment/+server.ts",
];

const KNOWN_GAPS: string[] = [];

const MUTATING = /export const (POST|PUT|PATCH|DELETE)/;

describe("money route inventory", () => {
  for (const file of MONEY_ROUTES) {
    it(`${file} validates its body`, () => {
      const source = readFileSync(file, "utf8");
      expect(MUTATING.test(source)).toBe(true);
      expect(
        source.includes('from "$lib/schemas/') ||
          source.includes("from '$lib/schemas/"),
      ).toBe(true);
    });
  }

  it("keeps the known-gap list honest", () => {
    for (const gap of KNOWN_GAPS) {
      expect(
        statSync(gap).isFile(),
        `${gap} no longer exists; remove it from KNOWN_GAPS`,
      ).toBe(true);
    }
  });
});
