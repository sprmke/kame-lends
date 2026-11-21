/**
 * Reminder digest shapes shared by the pure planner and the email renderer.
 * Keep this module free of server-only imports.
 */

export type ReminderDigestItemKind =
  "signature" | "upcoming" | "due_today" | "overdue";

export type ReminderDigestItem = {
  loanId: number;
  loanName: string;
  dueDateKey: string;
  totalAmount: number;
  kind: ReminderDigestItemKind;
  daysUntil?: number;
  daysOverdue?: number;
  signingUrl?: string;
};

export type ReminderDigestSections = {
  signatures: ReminderDigestItem[];
  upcoming: ReminderDigestItem[];
  dueToday: ReminderDigestItem[];
  overdue: ReminderDigestItem[];
};
