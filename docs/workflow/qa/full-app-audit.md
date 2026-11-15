# Full app audit (persona scripts)

Run on a local database only. Use one multi-interest loan, one single-interest
loan, one agent investor, one debt, and a test group.

## Common checks for every route

1. Loading skeleton, then content.
2. Empty state with a clear next action.
3. Error state (stop the API or use a bad id) with a recovery link.
4. 375px and 1440px widths; no horizontal scroll.
5. Keyboard only: tab order, focus return after dialogs, escape closes.
6. Screen reader label on every input and icon button.
7. Light and dark mode; price visibility on and off.
8. Online and offline (DevTools offline).
9. Money and dates match `buildLoanLedger` and Asia/Manila.
10. No `₱NaN`, no raw `toLocaleString` money, no em dash in copy.

## Owner pass

| Route                           | Script                                                                                                                                                                                                                                                                                |
| ------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `/dashboard`                    | Compare each card with the ledger. Interest Collected must equal cash applied to interest. Open Past due, Maturing, Pending disbursement.                                                                                                                                             |
| `/loans`                        | Switch table/cards/timeline/calendar. Filter by date range. Compare summary cards with the selection modal. Export PDF and CSV; spot-check one loan.                                                                                                                                  |
| `/loans/new`                    | Create a single-interest loan, then a multi-interest loan. Change the sent date and due date before typing a rate; periods must regenerate until you edit one. Add/remove a period. Switch Rate↔Fixed and confirm the value converts. Save with an empty period; it must be blocked.  |
| `/loans/[id]`                   | Edit the loan; confirm investors, periods, and payments remain afterwards (same payment ids). Record a partial payment; status becomes Incomplete. Revert a paid period; it must be refused. Complete the loan with a reason. Delete a payment; confirm the period status recomputes. |
| `/investors`, `/investors/[id]` | Card, table, detail, PDF, and CSV totals must match. An investor with two loans must show both schedules.                                                                                                                                                                             |
| `/borrowers/[id]`               | Overdue amount falls after a partial payment.                                                                                                                                                                                                                                         |
| `/debts`                        | First installment is one interval after the debt date. Month-end dates clamp.                                                                                                                                                                                                         |
| `/groups/[id]`                  | Interest visibility toggles. Calendar sync. Telegram test. Member sees read-only.                                                                                                                                                                                                     |
| `/settings`                     | Data health card runs for the owner and lists counts only. No repair buttons.                                                                                                                                                                                                         |
| `/loans/[id]/sign`              | Contract amounts equal the ledger. Duration text is correct. Phone signature pad works.                                                                                                                                                                                               |
| `+error`                        | 404 and 500 copy, no stack trace.                                                                                                                                                                                                                                                     |

## Party pass

Sign in as an investor, borrower, and witness. Confirm read-only rules, their
own commission only, and that amounts match the owner's screen for their slot.
As a group viewer, confirm read-only access to every group loan.

## Integrations pass

Google Calendar events equal schedule rows. Telegram messages equal the ledger.
Push reminders fire at Manila times. Emails link to the right loan. AI receipt
scan produces rows that validate.

## Recording

Add each issue to the plan tracker as `UX-xx` / `BUG-xx` with severity and
evidence. Do not fix inside the audit pass; triage first.
