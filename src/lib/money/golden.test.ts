import { describe, expect, it } from "vitest";
import { buildLoanLedger } from "./ledger";
import { GOLDEN_LOANS } from "./__fixtures__/loans";

describe("golden loans", () => {
  for (const fixture of GOLDEN_LOANS) {
    it(fixture.name, () => {
      const ledger = buildLoanLedger(fixture.loan, { today: fixture.today });
      const { periodStatuses: _periodStatuses, ...expected } = fixture.expected;
      expect({
        principalC: ledger.principalC,
        interestC: ledger.interestExpectedC,
        dueC: ledger.dueC,
        receivedC: ledger.receivedC,
        balanceC: ledger.balanceC,
        overdueC: ledger.overdueC,
        status: ledger.status,
      }).toEqual(expected);
      if (fixture.expected.periodStatuses) {
        expect(
          ledger.investors.flatMap((investor) =>
            investor.periods.map((period) => period.status),
          ),
        ).toEqual(fixture.expected.periodStatuses);
      }
    });
  }

  it("keeps the schedule equal to the loan total for every fixture", () => {
    for (const fixture of GOLDEN_LOANS) {
      const ledger = buildLoanLedger(fixture.loan, { today: fixture.today });
      const schedule =
        ledger.dueRows.reduce((sum, row) => sum + row.totalC, 0) +
        ledger.interestRows.reduce((sum, row) => sum + row.interestC, 0);
      expect(schedule, fixture.name).toBe(ledger.dueC);
    }
  });
});
