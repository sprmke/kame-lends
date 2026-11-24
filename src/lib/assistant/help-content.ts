/**
 * Static help snippets shipped with the build. No filesystem access at runtime
 * on Vercel. Keep each entry short and link to the page that does the work.
 */
export interface HelpEntry {
  id: string;
  title: string;
  text: string;
  href: string;
  keywords: string[];
}

export const HELP_ENTRIES: HelpEntry[] = [
  {
    id: "add-loan",
    title: "Create a loan",
    text: "Open Loans, tap New loan, choose the borrower and type, then add each investor tranche and the due date.",
    href: "/loans/new",
    keywords: ["create", "new", "loan", "add", "borrower"],
  },
  {
    id: "add-payment",
    title: "Record a payment",
    text: "Open the loan, choose Record payment, enter the amount and date, and link it to an interest period when you can.",
    href: "/loans",
    keywords: ["record", "payment", "received", "paid", "collect"],
  },
  {
    id: "unlinked-payment",
    title: "Fix an unlinked payment",
    text: "An unlinked payment is applied to the oldest open interest first. Open the loan to link it to a period.",
    href: "/loans",
    keywords: ["unlinked", "payment", "period", "link", "oldest"],
  },
  {
    id: "overdue",
    title: "Why a loan is overdue",
    text: "A loan becomes overdue the day after its due date in Asia/Manila, not on the due date itself.",
    href: "/loans",
    keywords: ["overdue", "late", "due", "date"],
  },
  {
    id: "interest",
    title: "How interest is computed",
    text: "Rate interest is principal times rate for each period, rounded once to the centavo. Fixed interest is a peso amount per period.",
    href: "/loans",
    keywords: ["interest", "rate", "fixed", "round", "compute"],
  },
  {
    id: "investor",
    title: "Add an investor",
    text: "Open Investors, tap New investor, and add the contact details. Link the investor to a user account to give them portal access.",
    href: "/investors/new",
    keywords: ["investor", "add", "capital", "portal"],
  },
  {
    id: "borrower",
    title: "Add a borrower",
    text: "Open Borrowers, tap New borrower, and add the contact details. A linked borrower account can see their own loans.",
    href: "/borrowers/new",
    keywords: ["borrower", "add", "contact"],
  },
  {
    id: "debt",
    title: "Track a bank loan",
    text: "Open Bank Loans, tap New bank loan, then enter principal, rate, interval, and term.",
    href: "/debts/new",
    keywords: ["bank", "debt", "loan", "borrow", "lender"],
  },
  {
    id: "group",
    title: "Create a group",
    text: "Open Groups, tap New group, then add loans or smart rules. Members get read-only access to the group loans.",
    href: "/groups",
    keywords: ["group", "share", "member", "rule"],
  },
  {
    id: "contract",
    title: "Send a contract for signing",
    text: "Open the loan and choose Contract. Invite the borrower, lenders, and witnesses by email.",
    href: "/loans",
    keywords: ["contract", "sign", "signature", "email", "witness"],
  },
  {
    id: "receipt",
    title: "Scan a receipt",
    text: "When adding a payment or disbursement, attach a photo and use Scan. Check the extracted fields before saving.",
    href: "/loans",
    keywords: ["receipt", "scan", "photo", "image", "reference"],
  },
  {
    id: "backup",
    title: "Back up your data",
    text: "Open Settings and choose Download backup for a full JSON export of the workspace.",
    href: "/settings",
    keywords: ["backup", "export", "download", "json"],
  },
  {
    id: "commission",
    title: "Set your commission",
    text: "Your commission is private to your account. Open a loan where you are a party to set it.",
    href: "/loans",
    keywords: ["commission", "profit", "share", "private"],
  },
  {
    id: "price-visibility",
    title: "Hide amounts on screen",
    text: "Use the eye control in the account menu or Settings to mask currency and percentages.",
    href: "/settings",
    keywords: ["hide", "mask", "price", "privacy", "amount"],
  },
  {
    id: "data-health",
    title: "Check data health",
    text: "Settings shows open money checks such as status drift and unlinked payments.",
    href: "/settings",
    keywords: ["data", "health", "check", "drift", "issue"],
  },
];
