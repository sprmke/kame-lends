import { describe, expect, it } from "vitest";
import { buildLoanLedger } from "./ledger";
import { GOLDEN_LOANS } from "./__fixtures__/loans";
import {
  calculateOverdueAmount,
  calculateTotalAmount,
  calculateTotalInterest,
  calculateTotalPrincipal,
} from "$lib/calculations";
import { buildLoanPaymentSchedule } from "$lib/loan-payment-schedule";
import type { LoanWithInvestors } from "$lib/types";

/**
 * Every screen and export reads a different adapter. This test proves they all
 * return the ledger's numbers for the same loan (RPT-03).
 */
describe("cross-screen reconciliation", () => {
  for (const fixture of GOLDEN_LOANS) {
    it(fixture.name, () => {
      const ledger = buildLoanLedger(fixture.loan, { today: fixture.today });
      const allocations = fixture.loan.loanInvestors;

      expect(calculateTotalPrincipal(allocations as never)).toBeCloseTo(
        ledger.principalC / 100,
        2,
      );
      expect(calculateTotalInterest(allocations as never)).toBeCloseTo(
        ledger.interestExpectedC / 100,
        2,
      );
      expect(calculateTotalAmount(allocations as never)).toBeCloseTo(
        ledger.dueC / 100,
        2,
      );
      expect(
        calculateOverdueAmount(
          allocations as never,
          fixture.loan.dueDate,
          fixture.today,
        ),
      ).toBeCloseTo(ledger.overdueC / 100, 2);

      const schedule = buildLoanPaymentSchedule(
        {
          id: fixture.loan.id ?? 1,
          dueDate: fixture.loan.dueDate,
          status: "Fully Funded",
          loanInvestors: allocations,
        } as unknown as LoanWithInvestors,
        { today: fixture.today },
      );
      const scheduleTotal =
        schedule.dues.reduce((sum, row) => sum + row.totalAmount, 0) +
        schedule.interests.reduce((sum, row) => sum + row.totalAmount, 0);
      expect(scheduleTotal).toBeCloseTo(ledger.dueC / 100, 2);
    });
  }
});
