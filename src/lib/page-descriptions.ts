/**
 * PageHeader subtitles for main app routes. One short sentence, period at end.
 */
export const PAGE_DESCRIPTIONS = {
  dashboard: "Overview of your lending performance and upcoming activity.",
  groups:
    "Loan groups with shared access, Google Calendar, and optional Telegram for parties on those loans.",
  dashboardGroups:
    "Shared calendars and read-only access for investors, borrowers, and witnesses on grouped loans.",
  settings: "Account, payment methods, backups, and maintenance tools.",
  investors: "Lender contacts and their loan activity.",
  borrowers: "Borrower contacts linked to your loans.",
  witnesses: "Witness contacts for contracts and signing.",
  bankLoans:
    "Borrowings from your lender contacts, separate from loans you issue.",
  transactions: "Money in and out across your lending activity.",
  transactionDetail: "Details for this transaction.",
  newTransaction: "Record money in or out.",
  loans: {
    loans: "Loans you operate and can edit.",
    investments: "Loans where you are an investor.",
    borrowed: "Loans where you are the borrower.",
    commissioned:
      "Your commission across loans you invest in, borrow on, or witness.",
    witnessed: "Loans where you are a witness.",
    group: "",
  },
} as const;
