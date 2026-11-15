# Money golden cases

Hand-checked cases for `buildLoanLedger` and every screen that shows money.
Fixtures: `src/lib/money/__fixtures__/loans.ts`. Tests:
`src/lib/money/golden.test.ts`.

Every value below is in pesos unless marked. "Paid" means the linked received
payment sum.

| #   | Case                              | Principal | Interest | Due       | Received | Balance   | Overdue | Status       |
| --- | --------------------------------- | --------- | -------- | --------- | -------- | --------- | ------- | ------------ |
| 1   | 100k at 3%                        | 100,000   | 3,000    | 103,000   | 0        | 103,000   | 0       | Fully Funded |
| 2   | 100k fixed 2,500                  | 100,000   | 2,500    | 102,500   | 0        | 102,500   | 0       | Fully Funded |
| 3   | Two tranches 100k + 50k at 3%     | 150,000   | 4,500    | 154,500   | 0        | 154,500   | 0       | Fully Funded |
| 4   | Agent 0 at 3% + 100k lender       | 100,000   | 6,000    | 106,000   | 0        | 106,000   | 0       | Fully Funded |
| 5   | Multi-period 5% + 5% on 150k      | 150,000   | 15,000   | 165,000   | 0        | 165,000   | 0       | Fully Funded |
| 6   | First period paid, final open     | 100,000   | 6,000    | 106,000   | 3,000    | 103,000   | 0       | Fully Funded |
| 7   | Partial first period              | 100,000   | 6,000    | 106,000   | 1,000    | 105,000   | 2,000   | Overdue      |
| 8   | Due today                         | 100,000   | 3,000    | 103,000   | 0        | 103,000   | 0       | Fully Funded |
| 9   | Fully paid                        | 100,000   | 3,000    | 103,000   | 103,000  | 0         | 0       | Completed    |
| 10  | All interest paid, principal open | 100,000   | 6,000    | 106,000   | 6,000    | 100,000   | 0       | Fully Funded |
| 11  | Unlinked payment 1,000            | 100,000   | 6,000    | 106,000   | 1,000    | 105,000   | 2,000   | Overdue      |
| 12  | Rounding 33,333.33 at 3.33%       | 33,333.33 | 1,110.00 | 34,443.33 | 0        | 34,443.33 | 0       | Fully Funded |

## Period status expectations

- Case 6: `Completed`, `Pending`.
- Case 7: `Incomplete`, `Pending`.
- Case 10: `Completed`, `Completed`.
- Case 11: `Incomplete`, `Pending` (unlinked money pays oldest interest first).

## Cross-screen checklist

For each fixture (or a production loan matching it), confirm the same numbers
on: `/loans` row and card, `/loans/[id]` summary and investor sections, the
calendar/timeline entry, the investor list and detail, the PDF, the CSV, the
dashboard card, and the Telegram message. Any mismatch is an S2 finding.

## Timezone

Run `bun run test:unit:tz`. The same cases must pass under `Asia/Manila`,
`UTC`, and `America/Los_Angeles`. Jan 31 to Mar 31 must read "2 Months".
