/**
 * Quick tools: one-tap questions. The same registry feeds the UI gallery and
 * the eval dataset, so every quick tool has a test.
 */
export type QuickToolGroup = "Loans" | "Money" | "People" | "Tools";

export interface QuickTool {
  id: string;
  group: QuickToolGroup;
  label: string;
  prompt: string;
  /** A pin the tool needs before it can send. */
  requires?: "borrower" | "investor" | "loan";
}

export const QUICK_TOOLS: QuickTool[] = [
  {
    id: "due-this-week",
    group: "Loans",
    label: "Due this week",
    prompt: "What is due this week?",
  },
  {
    id: "overdue",
    group: "Loans",
    label: "Overdue loans",
    prompt: "Which loans are overdue, and by how much?",
  },
  {
    id: "borrower-balance",
    group: "People",
    label: "Borrower balance",
    prompt: "How much does this borrower still owe?",
    requires: "borrower",
  },
  {
    id: "investor-returns",
    group: "People",
    label: "Investor returns",
    prompt:
      "How much interest has this investor collected, and what is still outstanding?",
    requires: "investor",
  },
  {
    id: "interest-month",
    group: "Money",
    label: "Interest this month",
    prompt:
      "How much interest was collected this month compared with what was expected?",
  },
  {
    id: "portfolio",
    group: "Money",
    label: "Portfolio totals",
    prompt:
      "Give me the portfolio totals: principal, outstanding, and overdue.",
  },
  {
    id: "cashflow",
    group: "Money",
    label: "Cashflow this quarter",
    prompt: "Show the cashflow for this quarter by month.",
  },
  {
    id: "explain-loan",
    group: "Loans",
    label: "Explain this loan",
    prompt: "Explain this loan's balance and schedule.",
    requires: "loan",
  },
  {
    id: "simulate-rate",
    group: "Tools",
    label: "Simulate a rate",
    prompt: "What if the rate on this loan were 3%?",
    requires: "loan",
  },
  {
    id: "unlinked-payments",
    group: "Tools",
    label: "Unlinked payments",
    prompt: "Are there payments that are not linked to an interest period?",
  },
  {
    id: "data-health",
    group: "Tools",
    label: "Data health",
    prompt: "Is anything wrong with my data?",
  },
  {
    id: "scan-receipt",
    group: "Tools",
    label: "Check a receipt",
    prompt: "Is this payment already recorded?",
  },
];

export function quickToolById(id: string): QuickTool | undefined {
  return QUICK_TOOLS.find((tool) => tool.id === id);
}

export interface StarterPrompt {
  label: string;
  prompt: string;
}

export function starterPrompts(input: {
  page: string | null;
  isOwner: boolean;
}): StarterPrompt[] {
  const page = input.page ?? "";
  const loanMatch = /^\/loans\/(\d+)/.exec(page);
  if (loanMatch) {
    return [
      {
        label: "Explain this loan",
        prompt: "Explain this loan's balance and schedule.",
      },
      {
        label: "What is due next",
        prompt: "What is the next payment due on this loan?",
      },
      {
        label: "Payment history",
        prompt: "Show the payments received on this loan.",
      },
      {
        label: "Simulate a rate",
        prompt: "What if the rate on this loan were 3%?",
      },
    ];
  }
  const borrowerMatch = /^\/borrowers\/(\d+)/.exec(page);
  if (borrowerMatch) {
    return [
      {
        label: "Borrower balance",
        prompt: "How much does this borrower still owe?",
      },
      { label: "Overdue?", prompt: "Is this borrower overdue on any loan?" },
      {
        label: "Payment history",
        prompt: "Show this borrower's payment history.",
      },
      {
        label: "Next due",
        prompt: "When is this borrower's next payment due?",
      },
    ];
  }
  const investorMatch = /^\/investors\/(\d+)/.exec(page);
  if (investorMatch) {
    return [
      {
        label: "Investor returns",
        prompt: "How much interest has this investor collected?",
      },
      {
        label: "Capital out",
        prompt: "How much capital does this investor have out?",
      },
      {
        label: "Outstanding",
        prompt: "What is this investor's outstanding balance?",
      },
      {
        label: "Funded loans",
        prompt: "Which loans is this investor funding?",
      },
    ];
  }
  const starters: StarterPrompt[] = [
    { label: "Due this week", prompt: "What is due this week?" },
    {
      label: "Overdue loans",
      prompt: "Which loans are overdue, and by how much?",
    },
    {
      label: "Interest this month",
      prompt: "How much interest was collected this month?",
    },
    { label: "Portfolio totals", prompt: "Give me the portfolio totals." },
  ];
  if (input.isOwner) {
    starters[3] = {
      label: "Data health",
      prompt: "Is anything wrong with my data?",
    };
  }
  return starters;
}
