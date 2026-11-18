/**
 * Column sets for payment / disbursement queries.
 *
 * Lean sets omit receipt image blobs (`receipt_image_url`, `receipts`,
 * `receipt_extracted_data`) so list, cache, backup, and cron paths do not pull
 * multi-hundred-KB JSON from Neon on every read. Detail/edit paths that show
 * receipts use the with-receipts sets (or `true` for all columns).
 */

/** Money-math fields for received_payments without image payloads. */
export const leanReceivedPaymentColumns = {
  id: true,
  loanInvestorId: true,
  interestPeriodId: true,
  amount: true,
  receivedDate: true,
  notes: true,
  createdAt: true,
  updatedAt: true,
  deletedAt: true,
} as const;

/** Full received_payments including receipt blobs (single-loan detail/edit). */
export const receivedPaymentColumnsWithReceipts = {
  ...leanReceivedPaymentColumns,
  receiptImageUrl: true,
  receiptExtractedData: true,
  receipts: true,
} as const;

/** loan_investors allocation fields without disbursement receipt blobs. */
export const leanLoanInvestorColumns = {
  id: true,
  loanId: true,
  investorId: true,
  amount: true,
  interestRate: true,
  interestType: true,
  sentDate: true,
  isPaid: true,
  hasMultipleInterest: true,
  profitType: true,
  profitValue: true,
  notes: true,
  deletedAt: true,
  createdAt: true,
  updatedAt: true,
} as const;

/** loan_investors including fund-transfer receipt blobs. */
export const loanInvestorColumnsWithReceipts = {
  ...leanLoanInvestorColumns,
  receiptImageUrl: true,
  receiptExtractedData: true,
  receipts: true,
} as const;

/** Nested under a loan: allocations + lean payments (backup / bulk). */
export const leanLoanInvestorNestUnderLoan = {
  columns: leanLoanInvestorColumns,
  with: {
    investor: true,
    interestPeriods: true,
    receivedPayments: { columns: leanReceivedPaymentColumns },
  },
} as const;

/** Nested under an investor CRM row: allocations + lean payments (backup). */
export const leanLoanInvestorNestUnderInvestor = {
  columns: leanLoanInvestorColumns,
  with: {
    loan: true,
    interestPeriods: true,
    receivedPayments: { columns: leanReceivedPaymentColumns },
  },
} as const;
