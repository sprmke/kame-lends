/**
 * PageHeader subtitles for main app routes. One short sentence, period at end.
 */
export const PAGE_DESCRIPTIONS = {
  dashboard: "Overview of your lending performance and upcoming activity.",
  groups: "Shared loan lists, people, and calendars for a lending circle.",
  settings: "Account, payment methods, backups, and maintenance tools.",
  investors: "Lender contacts and their loan activity.",
  borrowers: "Borrower contacts linked to your loans.",
  witnesses: "Witness contacts for contracts and signing.",
  bankLoans: "External loans tied to your investors.",
  transactions: "Money in and out across your lending activity.",
  transactionDetail: "Details for this transaction.",
  newTransaction: "Record money in or out.",
  loans: {
    loans: "Loans you operate and can edit.",
    investments: "Loans where you are an investor.",
    borrowed: "Loans where you are the borrower.",
    witnessed: "Loans where you are a witness.",
    group: "",
  },
} as const;
