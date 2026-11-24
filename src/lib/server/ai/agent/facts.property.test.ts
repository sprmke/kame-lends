import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { addC, mulRate, rateOf, subC } from "$lib/money/centavos";
import { FactStore, TokenStreamResolver, findUnverifiedNumbers } from "./facts";
import { calculateTool } from "../tools/calculate";
import type { ToolContext } from "./context";

function context(facts: FactStore): ToolContext {
  return {
    userId: "u1",
    email: null,
    role: "admin",
    today: "2026-11-21",
    page: null,
    pins: [],
    locale: "en",
    facts,
    viewer: {} as never,
    artifacts: [],
    disabledTools: new Set(),
    deadlineAt: Date.now() + 5_000,
    addArtifact: () => undefined,
  };
}

describe("TokenStreamResolver properties", () => {
  const textArbitrary = fc.constantFrom(
    "Balance {{f1}} as of {{f2}}.",
    "{{f1}}{{f2}}",
    "A {{f1}} B {{f2}} C",
    "No tokens here.",
    "Tail {{f1}} and a lone { brace.",
  );

  it("resolves identically no matter how the text is chunked", () => {
    fc.assert(
      fc.property(
        textArbitrary,
        fc.array(fc.nat({ max: 60 }), { maxLength: 8 }),
        (text, cuts) => {
          const facts = new FactStore();
          facts.addMoney(52_000_000, "Balance");
          facts.addDate("2026-11-21", "As of");

          const expected = text
            .replace(/\{\{f1\}\}/g, "₱520,000.00")
            .replace(/\{\{f2\}\}/g, "2026-11-21");

          const sorted = [...new Set(cuts)].sort((a, b) => a - b);
          const resolver = new TokenStreamResolver(facts);
          let offset = 0;
          let output = "";
          for (const cut of sorted) {
            const index = Math.min(cut, text.length);
            if (index <= offset) continue;
            output += resolver.feed(text.slice(offset, index));
            offset = index;
          }
          output += resolver.feed(text.slice(offset));
          output += resolver.flush();

          expect(output).toBe(expected);
          expect(resolver.violations()).toEqual([]);
        },
      ),
      { numRuns: 60 },
    );
  });
});

describe("findUnverifiedNumbers properties", () => {
  it("flags any amount typed without a fact token", () => {
    fc.assert(
      fc.property(fc.integer({ min: 0, max: 999_999_999 }), (amount) => {
        const text = `You owe ₱${amount.toLocaleString("en-US")} today.`;
        expect(findUnverifiedNumbers(text).length).toBeGreaterThan(0);
      }),
      { numRuns: 80 },
    );
  });

  it("never flags a list marker around an otherwise clean line", () => {
    fc.assert(
      fc.property(fc.integer({ min: 1, max: 99 }), (index) => {
        expect(
          findUnverifiedNumbers(`${index}. Loan #1 is due.`, new Set(["1"])),
        ).toEqual([]);
      }),
      { numRuns: 30 },
    );
  });
});

describe("calculate properties", () => {
  it("matches the centavo helpers for add, subtract, and difference", async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 0, max: 500_000_000 }),
        fc.integer({ min: 0, max: 500_000_000 }),
        async (left, right) => {
          for (const op of ["add", "subtract", "difference"] as const) {
            const facts = new FactStore();
            const a = facts.addMoney(left, "A");
            const b = facts.addMoney(right, "B");
            await calculateTool.run(
              { op, factIds: [a.id, b.id] },
              context(facts),
            );
            const result = facts.all().at(-1)!;
            const expected =
              op === "add"
                ? addC(left, right)
                : op === "subtract"
                  ? subC(left, right)
                  : Math.abs(subC(left, right));
            expect(result.value).toBe(expected);
          }
        },
      ),
      { numRuns: 40 },
    );
  });

  it("matches rateOf and mulRate for percentages", async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 0, max: 500_000_000 }),
        fc.integer({ min: 0, max: 500_000_000 }),
        fc.double({ min: 0, max: 100, noNaN: true }),
        async (part, whole, rate) => {
          const percentFacts = new FactStore();
          const partFact = percentFacts.addMoney(part, "Part");
          const wholeFact = percentFacts.addMoney(whole, "Whole");
          await calculateTool.run(
            { op: "percentOf", factIds: [partFact.id, wholeFact.id] },
            context(percentFacts),
          );
          expect(percentFacts.all().at(-1)!.value).toBe(rateOf(part, whole));

          const rateFacts = new FactStore();
          const money = rateFacts.addMoney(part, "Amount");
          const percent = rateFacts.addPercent(rate, "Rate");
          await calculateTool.run(
            { op: "applyRate", factIds: [money.id, percent.id] },
            context(rateFacts),
          );
          expect(rateFacts.all().at(-1)!.value).toBe(mulRate(part, rate));
        },
      ),
      { numRuns: 40 },
    );
  });
});
