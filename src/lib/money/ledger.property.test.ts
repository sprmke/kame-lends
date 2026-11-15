import { describe, expect, it } from "vitest";
import fc from "fast-check";
import {
  buildLoanLedger,
  type LedgerAllocationInput,
  type LedgerLoanInput,
} from "./ledger";

const TODAY = "2026-06-15";

function loanArbitrary() {
  return fc
    .tuple(
      fc.integer({ min: 0, max: 500_000_00 }),
      fc.integer({ min: 0, max: 2000 }),
      fc.array(fc.integer({ min: 1, max: 5 }), { minLength: 1, maxLength: 3 }),
      fc.constantFrom("2026-03-31", "2026-06-30"),
    )
    .map((args) => {
      const capitalC = Number(args[0]);
      const rateBp = Number(args[1]);
      const trancheCount = Number(args[2]);
      const dueDate = String(args[3]);
      const perTranche = Math.floor(capitalC / trancheCount);
      const loanInvestors: LedgerAllocationInput[] = Array.from(
        { length: trancheCount },
        (_, index) => ({
          id: index + 1,
          investor: { id: 1, name: "Ana" },
          amount: (perTranche / 100).toFixed(2),
          interestRate: (rateBp / 100).toFixed(2),
          interestType: "rate" as const,
          isPaid: true,
          receivedPayments: [],
        }),
      );
      return { dueDate, loanInvestors } satisfies LedgerLoanInput;
    });
}

describe("ledger properties", () => {
  it("sums due rows and interest rows to the loan total", () => {
    fc.assert(
      fc.property(loanArbitrary(), (loan) => {
        const ledger = buildLoanLedger(loan, { today: TODAY });
        const due = ledger.dueRows.reduce((sum, row) => sum + row.totalC, 0);
        const interest = ledger.interestRows.reduce(
          (sum, row) => sum + row.interestC,
          0,
        );
        expect(due + interest).toBe(ledger.dueC);
      }),
      { numRuns: 100 },
    );
  });

  it("never has a negative balance when payments are zero", () => {
    fc.assert(
      fc.property(loanArbitrary(), (loan) => {
        const ledger = buildLoanLedger(loan, { today: TODAY });
        expect(ledger.balanceC).toBeGreaterThanOrEqual(0);
        expect(ledger.receivedC).toBe(0);
      }),
      { numRuns: 100 },
    );
  });

  it("is not overdue on the due date and is overdue the next day", () => {
    fc.assert(
      fc.property(fc.constantFrom("2026-03-31", "2026-06-30"), (dueDate) => {
        const loan: LedgerLoanInput = {
          dueDate,
          loanInvestors: [
            {
              id: 1,
              investor: { id: 1, name: "Ana" },
              amount: "100000",
              interestRate: "3",
              interestType: "rate",
              isPaid: true,
            },
          ],
        };
        expect(buildLoanLedger(loan, { today: dueDate }).status).not.toBe(
          "Overdue",
        );
        const nextDay = new Date(`${dueDate}T00:00:00Z`);
        nextDay.setUTCDate(nextDay.getUTCDate() + 1);
        expect(
          buildLoanLedger(loan, {
            today: nextDay.toISOString().slice(0, 10),
          }).status,
        ).toBe("Overdue");
      }),
      { numRuns: 20 },
    );
  });

  it("does not change totals when tranche order is reversed", () => {
    fc.assert(
      fc.property(loanArbitrary(), (loan) => {
        const forward = buildLoanLedger(loan, { today: TODAY });
        const reversed = buildLoanLedger(
          { ...loan, loanInvestors: [...loan.loanInvestors].reverse() },
          { today: TODAY },
        );
        expect(reversed.dueC).toBe(forward.dueC);
        expect(reversed.balanceC).toBe(forward.balanceC);
      }),
      { numRuns: 100 },
    );
  });
});
