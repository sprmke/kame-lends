import {
  pgTable,
  text,
  serial,
  integer,
  bigint,
  decimal,
  timestamp,
  boolean,
  jsonb,
  pgEnum,
  primaryKey,
  index,
  unique,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { relations, sql } from "drizzle-orm";
import type { AdapterAccount } from "@auth/core/adapters";
import type { ReceiptExtractedData } from "$lib/receipt-extraction-types";
import type { PaymentReceipt } from "$lib/payment-receipts";

// Enums
export const userRoleEnum = pgEnum("user_role", [
  "admin",
  "investor",
  "borrower",
  "witness",
]);
export const loanTypeEnum = pgEnum("loan_type", [
  "Lot Title",
  "OR/CR",
  "Agent",
]);
export const loanStatusEnum = pgEnum("loan_status", [
  "Partially Funded",
  "Fully Funded",
  "Overdue",
  "Completed",
]);
export const transactionTypeEnum = pgEnum("transaction_type", ["Investment"]);
export const transactionDirectionEnum = pgEnum("transaction_direction", [
  "In",
  "Out",
]);
export const interestTypeEnum = pgEnum("interest_type", ["rate", "fixed"]);
export const interestPeriodStatusEnum = pgEnum("interest_period_status", [
  "Pending",
  "Incomplete",
  "Completed",
  "Overdue",
]);
export const debtInterestIntervalEnum = pgEnum("debt_interest_interval", [
  "Daily",
  "Weekly",
  "Monthly",
  "Annually",
]);
export const signingPartyRoleEnum = pgEnum("signing_party_role", [
  "borrower",
  "lender",
  "witness_1",
  "witness_2",
]);
export const groupRulePartyTypeEnum = pgEnum("group_rule_party_type", [
  "investor",
  "borrower",
]);
export const groupCalendarStatusEnum = pgEnum("group_calendar_status", [
  "provisioning",
  "active",
  "error",
]);
export const groupTelegramStatusEnum = pgEnum("group_telegram_status", [
  "disconnected",
  "connected",
  "bot_removed",
]);
export const groupNotificationStatusEnum = pgEnum("group_notification_status", [
  "claimed",
  "sent",
  "failed",
]);
export const integrationJobStatusEnum = pgEnum("integration_job_status", [
  "pending",
  "running",
  "done",
  "failed",
]);

// Investors Table
export const investors = pgTable(
  "investors",
  {
    id: serial("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    investorUserId: text("investor_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    name: text("name").notNull(),
    email: text("email").notNull(),
    contactNumber: text("contact_number"),
    address: text("address"),
    validIdUrl: text("valid_id_url"),
    eSignatureUrl: text("e_signature_url"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    userIdIdx: index("investors_user_id_idx").on(table.userId),
    investorUserIdIdx: index("investors_investor_user_id_idx").on(
      table.investorUserId,
    ),
  }),
);

// Borrowers Table
export const borrowers = pgTable(
  "borrowers",
  {
    id: serial("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    borrowerUserId: text("borrower_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    name: text("name").notNull(),
    contactNumber: text("contact_number"),
    email: text("email"),
    address: text("address"),
    notes: text("notes"),
    validIdUrl: text("valid_id_url"),
    eSignatureUrl: text("e_signature_url"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    userIdIdx: index("borrowers_user_id_idx").on(table.userId),
    borrowerUserIdIdx: index("borrowers_borrower_user_id_idx").on(
      table.borrowerUserId,
    ),
  }),
);

// Reusable contract witnesses
export const witnesses = pgTable(
  "witnesses",
  {
    id: serial("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    witnessUserId: text("witness_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    name: text("name").notNull(),
    email: text("email"),
    contactNumber: text("contact_number"),
    address: text("address"),
    validIdUrl: text("valid_id_url"),
    eSignatureUrl: text("e_signature_url"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    userIdIdx: index("witnesses_user_id_idx").on(table.userId),
    witnessUserIdIdx: index("witnesses_witness_user_id_idx").on(
      table.witnessUserId,
    ),
    userNameIdx: index("witnesses_user_name_idx").on(table.userId, table.name),
  }),
);

// Loans Table
export const loans = pgTable(
  "loans",
  {
    id: serial("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    borrowerId: integer("borrower_id").references(() => borrowers.id, {
      onDelete: "restrict",
    }),
    loanName: text("loan_name").notNull(),
    type: loanTypeEnum("type").notNull(),
    status: loanStatusEnum("status").notNull().default("Fully Funded"),
    dueDate: timestamp("due_date").notNull(),
    freeLotSqm: integer("free_lot_sqm"),
    notes: text("notes"),
    profitType: interestTypeEnum("profit_type").notNull().default("rate"),
    profitValue: decimal("profit_value", { precision: 15, scale: 2 })
      .notNull()
      .default("0"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    userIdIdx: index("loans_user_id_idx").on(table.userId),
    borrowerIdIdx: index("loans_borrower_id_idx").on(table.borrowerId),
    dueDateIdx: index("loans_due_date_idx").on(table.dueDate),
  }),
);

// Loan Contracts (persisted customization for signing)
export const loanContracts = pgTable("loan_contracts", {
  id: serial("id").primaryKey(),
  loanId: integer("loan_id")
    .references(() => loans.id, { onDelete: "cascade" })
    .notNull()
    .unique(),
  customization: jsonb("customization").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Loan Signing Invitations (shareable e-signature links per party)
export const loanSigningInvitations = pgTable(
  "loan_signing_invitations",
  {
    id: serial("id").primaryKey(),
    loanId: integer("loan_id")
      .references(() => loans.id, { onDelete: "cascade" })
      .notNull(),
    contractId: integer("contract_id")
      .references(() => loanContracts.id, { onDelete: "cascade" })
      .notNull(),
    token: text("token").unique(),
    partyRole: signingPartyRoleEnum("party_role").notNull(),
    investorId: integer("investor_id").references(() => investors.id, {
      onDelete: "set null",
    }),
    witnessId: integer("witness_id").references(() => witnesses.id, {
      onDelete: "set null",
    }),
    partyName: text("party_name").notNull(),
    partyEmail: text("party_email"),
    signatureDataUrl: text("signature_data_url"),
    signedAt: timestamp("signed_at"),
    consentedAt: timestamp("consented_at"),
    expiresAt: timestamp("expires_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    loanIdIdx: index("loan_signing_invitations_loan_id_idx").on(table.loanId),
    witnessIdIdx: index("loan_signing_invitations_witness_id_idx").on(
      table.witnessId,
    ),
  }),
);

// Loan Investors (Junction Table)
export const loanInvestors = pgTable(
  "loan_investors",
  {
    id: serial("id").primaryKey(),
    loanId: integer("loan_id")
      .references(() => loans.id, { onDelete: "cascade" })
      .notNull(),
    investorId: integer("investor_id")
      .references(() => investors.id, { onDelete: "cascade" })
      .notNull(),
    amount: decimal("amount", { precision: 15, scale: 2 }).notNull(),
    interestRate: decimal("interest_rate", {
      precision: 15,
      scale: 2,
    }).notNull(),
    interestType: interestTypeEnum("interest_type").notNull().default("rate"),
    sentDate: timestamp("sent_date").notNull(),
    isPaid: boolean("is_paid").notNull().default(true),
    hasMultipleInterest: boolean("has_multiple_interest")
      .notNull()
      .default(false),
    profitType: interestTypeEnum("profit_type").notNull().default("rate"),
    profitValue: decimal("profit_value", { precision: 15, scale: 2 })
      .notNull()
      .default("0"),
    /** Evidence of the investor's fund transfer (`data:` URL legacy or `storage:` R2 ref). */
    receiptImageUrl: text("receipt_image_url"),
    /** AI-extracted snapshot from receiptImageUrl at upload time; kept for audit even if fields are later hand-edited. */
    receiptExtractedData: jsonb(
      "receipt_extracted_data",
    ).$type<ReceiptExtractedData | null>(),
    /** All fund-transfer receipts for this disbursement. First item mirrors the legacy columns. */
    receipts: jsonb("receipts")
      .$type<PaymentReceipt[]>()
      .notNull()
      .default(sql`'[]'::jsonb`),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    loanIdIdx: index("loan_investors_loan_id_idx").on(table.loanId),
    investorIdIdx: index("loan_investors_investor_id_idx").on(table.investorId),
  }),
);

// Per-user commission on a loan (private to the user who set it).
export const loanUserCommissions = pgTable(
  "loan_user_commissions",
  {
    id: serial("id").primaryKey(),
    loanId: integer("loan_id")
      .references(() => loans.id, { onDelete: "cascade" })
      .notNull(),
    userId: text("user_id")
      .references(() => users.id, { onDelete: "cascade" })
      .notNull(),
    profitType: interestTypeEnum("profit_type").notNull().default("rate"),
    profitValue: decimal("profit_value", { precision: 15, scale: 2 })
      .notNull()
      .default("0"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    loanUserUnique: unique("loan_user_commissions_loan_user_unique").on(
      table.loanId,
      table.userId,
    ),
    userIdIdx: index("loan_user_commissions_user_id_idx").on(table.userId),
    loanIdIdx: index("loan_user_commissions_loan_id_idx").on(table.loanId),
  }),
);

// Loan Witnesses (Junction Table — witness profit per loan)
export const loanWitnesses = pgTable(
  "loan_witnesses",
  {
    id: serial("id").primaryKey(),
    loanId: integer("loan_id")
      .references(() => loans.id, { onDelete: "cascade" })
      .notNull(),
    witnessId: integer("witness_id")
      .references(() => witnesses.id, { onDelete: "cascade" })
      .notNull(),
    profitType: interestTypeEnum("profit_type").notNull().default("rate"),
    profitValue: decimal("profit_value", { precision: 15, scale: 2 })
      .notNull()
      .default("0"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    loanIdIdx: index("loan_witnesses_loan_id_idx").on(table.loanId),
    witnessIdIdx: index("loan_witnesses_witness_id_idx").on(table.witnessId),
    loanWitnessUnique: unique("loan_witnesses_loan_witness_unique").on(
      table.loanId,
      table.witnessId,
    ),
  }),
);

// Loan Groups (shared loan sets with derived membership, calendar, Telegram)
export const loanGroups = pgTable(
  "loan_groups",
  {
    id: serial("id").primaryKey(),
    creatorUserId: text("creator_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    /** UI label: Description */
    notes: text("notes"),
    color: text("color").notNull().default("orange"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    creatorUserIdIdx: index("loan_groups_creator_user_id_idx").on(
      table.creatorUserId,
    ),
    creatorNameIdx: index("loan_groups_creator_user_id_name_idx").on(
      table.creatorUserId,
      table.name,
    ),
  }),
);

// Loan Group Loans (Junction Table)
export const loanGroupLoans = pgTable(
  "loan_group_loans",
  {
    id: serial("id").primaryKey(),
    groupId: integer("group_id")
      .references(() => loanGroups.id, { onDelete: "cascade" })
      .notNull(),
    loanId: integer("loan_id")
      .references(() => loans.id, { onDelete: "cascade" })
      .notNull(),
    addedByUserId: text("added_by_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    /** 'manual' | 'rule' */
    source: text("source").notNull().default("manual"),
    addedAt: timestamp("added_at").defaultNow().notNull(),
  },
  (table) => ({
    groupIdIdx: index("loan_group_loans_group_id_idx").on(table.groupId),
    loanIdIdx: index("loan_group_loans_loan_id_idx").on(table.loanId),
    groupLoanUnique: unique("loan_group_loans_group_loan_unique").on(
      table.groupId,
      table.loanId,
    ),
  }),
);

/** Derived membership cache: rewritten only by recomputeGroupMembers. */
export const loanGroupMembers = pgTable(
  "loan_group_members",
  {
    id: serial("id").primaryKey(),
    groupId: integer("group_id")
      .references(() => loanGroups.id, { onDelete: "cascade" })
      .notNull(),
    userId: text("user_id")
      .references(() => users.id, { onDelete: "cascade" })
      .notNull(),
    partyRoles: text("party_roles")
      .array()
      .notNull()
      .default(sql`'{}'::text[]`),
    syncedAt: timestamp("synced_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    groupIdIdx: index("loan_group_members_group_id_idx").on(table.groupId),
    userIdIdx: index("loan_group_members_user_id_idx").on(table.userId),
    groupUserUnique: unique("loan_group_members_group_user_unique").on(
      table.groupId,
      table.userId,
    ),
  }),
);

/** Smart group rules: auto-add future loans for a contact. */
export const loanGroupRules = pgTable(
  "loan_group_rules",
  {
    id: serial("id").primaryKey(),
    groupId: integer("group_id")
      .references(() => loanGroups.id, { onDelete: "cascade" })
      .notNull(),
    partyType: groupRulePartyTypeEnum("party_type").notNull(),
    contactId: integer("contact_id").notNull(),
    createdByUserId: text("created_by_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => ({
    groupIdIdx: index("loan_group_rules_group_id_idx").on(table.groupId),
    partyContactIdx: index("loan_group_rules_party_contact_idx").on(
      table.partyType,
      table.contactId,
    ),
    groupPartyContactUnique: unique(
      "loan_group_rules_group_party_contact_unique",
    ).on(table.groupId, table.partyType, table.contactId),
  }),
);

export const groupCalendars = pgTable("group_calendars", {
  groupId: integer("group_id")
    .primaryKey()
    .references(() => loanGroups.id, { onDelete: "cascade" }),
  googleCalendarId: text("google_calendar_id").unique(),
  status: groupCalendarStatusEnum("status").notNull().default("provisioning"),
  lastEventSyncAt: timestamp("last_event_sync_at"),
  lastAclSyncAt: timestamp("last_acl_sync_at"),
  lastError: text("last_error"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const groupTelegramSettings = pgTable(
  "group_telegram_settings",
  {
    groupId: integer("group_id")
      .primaryKey()
      .references(() => loanGroups.id, { onDelete: "cascade" }),
    chatId: text("chat_id"),
    chatTitle: text("chat_title"),
    chatType: text("chat_type"),
    status: groupTelegramStatusEnum("status").notNull().default("disconnected"),
    enabled: boolean("enabled").notNull().default(true),
    notifyUpcoming: boolean("notify_upcoming").notNull().default(true),
    reminderDays: integer("reminder_days")
      .array()
      .notNull()
      .default(sql`'{3,1}'::integer[]`),
    notifyDueToday: boolean("notify_due_today").notNull().default(true),
    notifyOverdue: boolean("notify_overdue").notNull().default(true),
    overdueRepeatEveryDays: integer("overdue_repeat_every_days")
      .notNull()
      .default(1),
    notifyDailyDigest: boolean("notify_daily_digest").notNull().default(false),
    notifyActivity: boolean("notify_activity").notNull().default(true),
    includeAmounts: boolean("include_amounts").notNull().default(true),
    botToken: text("bot_token"),
    templates: jsonb("templates")
      .$type<Record<string, string>>()
      .notNull()
      .default({}),
    linkedByUserId: text("linked_by_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    linkedAt: timestamp("linked_at"),
    lastSentAt: timestamp("last_sent_at"),
    lastError: text("last_error"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    chatIdUnique: uniqueIndex("group_telegram_settings_chat_id_unique")
      .on(table.chatId)
      .where(sql`${table.chatId} IS NOT NULL`),
  }),
);

export const telegramLinkTokens = pgTable(
  "telegram_link_tokens",
  {
    id: serial("id").primaryKey(),
    groupId: integer("group_id")
      .references(() => loanGroups.id, { onDelete: "cascade" })
      .notNull(),
    tokenHash: text("token_hash").notNull(),
    createdByUserId: text("created_by_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    expiresAt: timestamp("expires_at").notNull(),
    usedAt: timestamp("used_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => ({
    tokenHashUnique: uniqueIndex("telegram_link_tokens_token_hash_unique").on(
      table.tokenHash,
    ),
    groupIdIdx: index("telegram_link_tokens_group_id_idx").on(table.groupId),
  }),
);

export const pushSubscriptions = pgTable(
  "push_subscriptions",
  {
    id: serial("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    endpoint: text("endpoint").notNull(),
    p256dh: text("p256dh").notNull(),
    auth: text("auth").notNull(),
    userAgent: text("user_agent"),
    deviceLabel: text("device_label"),
    failureCount: integer("failure_count").notNull().default(0),
    disabledAt: timestamp("disabled_at"),
    lastSuccessAt: timestamp("last_success_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    endpointUnique: unique("push_subscriptions_endpoint_unique").on(
      table.endpoint,
    ),
    userIdIdx: index("push_subscriptions_user_id_idx").on(table.userId),
  }),
);

export const pushNotificationLog = pgTable(
  "push_notification_log",
  {
    id: serial("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    fingerprint: text("fingerprint").notNull(),
    kind: text("kind").notNull(),
    status: groupNotificationStatusEnum("status").notNull().default("claimed"),
    attempts: integer("attempts").notNull().default(0),
    error: text("error"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    sentAt: timestamp("sent_at"),
  },
  (table) => ({
    userFingerprintUnique: unique(
      "push_notification_log_user_fingerprint_unique",
    ).on(table.userId, table.fingerprint),
    statusCreatedAtIdx: index("push_notification_log_status_created_at_idx").on(
      table.status,
      table.createdAt,
    ),
  }),
);

export const userPushPreferences = pgTable("user_push_preferences", {
  userId: text("user_id")
    .primaryKey()
    .references(() => users.id, { onDelete: "cascade" }),
  notifyUpcoming: boolean("notify_upcoming").notNull().default(true),
  reminderDays: integer("reminder_days").array().notNull().default([3, 1]),
  notifyDueToday: boolean("notify_due_today").notNull().default(true),
  notifyOverdue: boolean("notify_overdue").notNull().default(true),
  notifyActivity: boolean("notify_activity").notNull().default(true),
  notifySigning: boolean("notify_signing").notNull().default(true),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const groupNotificationLog = pgTable(
  "group_notification_log",
  {
    id: serial("id").primaryKey(),
    groupId: integer("group_id")
      .references(() => loanGroups.id, { onDelete: "cascade" })
      .notNull(),
    fingerprint: text("fingerprint").notNull(),
    kind: text("kind").notNull(),
    status: groupNotificationStatusEnum("status").notNull().default("claimed"),
    attempts: integer("attempts").notNull().default(0),
    telegramMessageId: text("telegram_message_id"),
    error: text("error"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    sentAt: timestamp("sent_at"),
  },
  (table) => ({
    groupFingerprintUnique: unique(
      "group_notification_log_group_fingerprint_unique",
    ).on(table.groupId, table.fingerprint),
    statusCreatedAtIdx: index(
      "group_notification_log_status_created_at_idx",
    ).on(table.status, table.createdAt),
  }),
);

/** Outbox for Google Calendar and Telegram side effects. groupId has no FK. */
export const integrationJobs = pgTable(
  "integration_jobs",
  {
    id: bigint("id", { mode: "number" })
      .generatedAlwaysAsIdentity()
      .primaryKey(),
    kind: text("kind").notNull(),
    groupId: integer("group_id"),
    payload: jsonb("payload")
      .$type<Record<string, unknown>>()
      .notNull()
      .default({}),
    dedupeKey: text("dedupe_key"),
    status: integrationJobStatusEnum("status").notNull().default("pending"),
    attempts: integer("attempts").notNull().default(0),
    runAfter: timestamp("run_after").defaultNow().notNull(),
    lockedAt: timestamp("locked_at"),
    lastError: text("last_error"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    pendingDedupeUnique: uniqueIndex("integration_jobs_pending_dedupe_unique")
      .on(table.dedupeKey)
      .where(
        sql`${table.status} = 'pending' AND ${table.dedupeKey} IS NOT NULL`,
      ),
    statusRunAfterIdx: index("integration_jobs_status_run_after_idx").on(
      table.status,
      table.runAfter,
    ),
  }),
);

// Interest Periods Table (for multiple interest due dates)
export const interestPeriods = pgTable(
  "interest_periods",
  {
    id: serial("id").primaryKey(),
    loanInvestorId: integer("loan_investor_id")
      .references(() => loanInvestors.id, { onDelete: "cascade" })
      .notNull(),
    dueDate: timestamp("due_date").notNull(),
    interestRate: decimal("interest_rate", {
      precision: 15,
      scale: 2,
    }).notNull(),
    interestType: interestTypeEnum("interest_type").notNull().default("rate"),
    status: interestPeriodStatusEnum("status").notNull().default("Pending"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    loanInvestorIdIdx: index("interest_periods_loan_investor_id_idx").on(
      table.loanInvestorId,
    ),
  }),
);

// Received Payments (payments received back from borrower, per loan investor)
export const receivedPayments = pgTable(
  "received_payments",
  {
    id: serial("id").primaryKey(),
    loanInvestorId: integer("loan_investor_id")
      .references(() => loanInvestors.id, { onDelete: "cascade" })
      .notNull(),
    /** When set, this receipt applies toward this interest period (partial or full). */
    interestPeriodId: integer("interest_period_id").references(
      () => interestPeriods.id,
      {
        onDelete: "set null",
      },
    ),
    amount: decimal("amount", { precision: 15, scale: 2 }).notNull(),
    receivedDate: timestamp("received_date").notNull(),
    /** Evidence of the borrower's repayment (`data:` URL legacy or `storage:` R2 ref). */
    receiptImageUrl: text("receipt_image_url"),
    /** AI-extracted snapshot from receiptImageUrl at upload time; kept for audit even if fields are later hand-edited. */
    receiptExtractedData: jsonb(
      "receipt_extracted_data",
    ).$type<ReceiptExtractedData | null>(),
    /** All repayment receipts for this payment. First item mirrors the legacy columns. */
    receipts: jsonb("receipts")
      .$type<PaymentReceipt[]>()
      .notNull()
      .default(sql`'[]'::jsonb`),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    loanInvestorIdIdx: index("received_payments_loan_investor_id_idx").on(
      table.loanInvestorId,
    ),
  }),
);

// Debts Table
export const debts = pgTable(
  "debts",
  {
    id: serial("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    investorId: integer("investor_id")
      .references(() => investors.id, { onDelete: "cascade" })
      .notNull(),
    name: text("name").notNull(),
    amount: decimal("amount", { precision: 15, scale: 2 }).notNull(),
    date: timestamp("date").notNull(),
    interestRate: decimal("interest_rate", {
      precision: 15,
      scale: 6,
    }).notNull(),
    interestInterval: debtInterestIntervalEnum("interest_interval")
      .notNull()
      .default("Monthly"),
    durationMonths: integer("duration_months").notNull().default(12),
    additionalFees: jsonb("additional_fees")
      .$type<Array<{ label: string; amount: string }>>()
      .default([]),
    notes: text("notes"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    userIdIdx: index("debts_user_id_idx").on(table.userId),
    investorIdIdx: index("debts_investor_id_idx").on(table.investorId),
  }),
);

// Debt interest periods (scheduled interest due per payment period)
export const debtInterestPeriods = pgTable(
  "debt_interest_periods",
  {
    id: serial("id").primaryKey(),
    debtId: integer("debt_id")
      .references(() => debts.id, { onDelete: "cascade" })
      .notNull(),
    periodNumber: integer("period_number").notNull(),
    dueDate: timestamp("due_date").notNull(),
    expectedInterest: decimal("expected_interest", {
      precision: 15,
      scale: 2,
    }).notNull(),
    status: interestPeriodStatusEnum("status").notNull().default("Pending"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    debtIdIdx: index("debt_interest_periods_debt_id_idx").on(table.debtId),
  }),
);

// Debt received payments (interest payments per debt period)
export const debtReceivedPayments = pgTable(
  "debt_received_payments",
  {
    id: serial("id").primaryKey(),
    debtInterestPeriodId: integer("debt_interest_period_id")
      .references(() => debtInterestPeriods.id, { onDelete: "cascade" })
      .notNull(),
    amount: decimal("amount", { precision: 15, scale: 2 }).notNull(),
    receivedDate: timestamp("received_date").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    periodIdIdx: index("debt_received_payments_period_id_idx").on(
      table.debtInterestPeriodId,
    ),
  }),
);

// Transactions Table
export const transactions = pgTable(
  "transactions",
  {
    id: serial("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    investorId: integer("investor_id")
      .references(() => investors.id, { onDelete: "cascade" })
      .notNull(),
    loanId: integer("loan_id").references(() => loans.id, {
      onDelete: "cascade",
    }),
    date: timestamp("date").notNull(),
    type: transactionTypeEnum("type").notNull(),
    direction: transactionDirectionEnum("direction").notNull(),
    name: text("name").notNull(),
    amount: decimal("amount", { precision: 15, scale: 2 }).notNull(),
    balance: decimal("balance", { precision: 15, scale: 2 }).notNull(),
    notes: text("notes"),
    transactionIndex: integer("transaction_index"),
    transactionTotal: integer("transaction_total"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    userIdIdx: index("transactions_user_id_idx").on(table.userId),
    investorIdIdx: index("transactions_investor_id_idx").on(table.investorId),
    loanIdIdx: index("transactions_loan_id_idx").on(table.loanId),
    dateIdx: index("transactions_date_idx").on(table.date),
  }),
);

// Auth.js Tables
export const users = pgTable("user", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  name: text("name"),
  email: text("email").notNull().unique(),
  emailVerified: timestamp("emailVerified", { mode: "date" }),
  image: text("image"),
  role: userRoleEnum("role"),
});

/** Bank / QR details for receiving loan payments. Visible to borrowers on loan detail only. */
export const paymentMethods = pgTable(
  "payment_methods",
  {
    id: serial("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    bankName: text("bank_name").notNull(),
    accountNumber: text("account_number").notNull(),
    qrCodeUrl: text("qr_code_url"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    userIdIdx: index("payment_methods_user_id_idx").on(table.userId),
  }),
);

export const accounts = pgTable(
  "account",
  {
    userId: text("userId")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    type: text("type").notNull(),
    provider: text("provider").notNull(),
    providerAccountId: text("providerAccountId").notNull(),
    refresh_token: text("refresh_token"),
    access_token: text("access_token"),
    expires_at: integer("expires_at"),
    token_type: text("token_type"),
    scope: text("scope"),
    id_token: text("id_token"),
    session_state: text("session_state"),
  },
  (account) => ({
    compoundKey: primaryKey({
      columns: [account.provider, account.providerAccountId],
    }),
  }),
);

export const sessions = pgTable("session", {
  sessionToken: text("sessionToken").primaryKey(),
  userId: text("userId")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  expires: timestamp("expires", { mode: "date" }).notNull(),
});

export const verificationTokens = pgTable(
  "verificationToken",
  {
    identifier: text("identifier").notNull(),
    token: text("token").notNull(),
    expires: timestamp("expires", { mode: "date" }).notNull(),
  },
  (vt) => ({
    compoundKey: primaryKey({ columns: [vt.identifier, vt.token] }),
  }),
);

// Relations
export const borrowersRelations = relations(borrowers, ({ one, many }) => ({
  user: one(users, {
    fields: [borrowers.userId],
    references: [users.id],
  }),
  borrowerUser: one(users, {
    fields: [borrowers.borrowerUserId],
    references: [users.id],
  }),
  loans: many(loans),
}));

export const witnessesRelations = relations(witnesses, ({ one, many }) => ({
  user: one(users, {
    fields: [witnesses.userId],
    references: [users.id],
  }),
  witnessUser: one(users, {
    fields: [witnesses.witnessUserId],
    references: [users.id],
  }),
  loanWitnesses: many(loanWitnesses),
  signingInvitations: many(loanSigningInvitations),
}));

export const loanWitnessesRelations = relations(loanWitnesses, ({ one }) => ({
  loan: one(loans, {
    fields: [loanWitnesses.loanId],
    references: [loans.id],
  }),
  witness: one(witnesses, {
    fields: [loanWitnesses.witnessId],
    references: [witnesses.id],
  }),
}));

export const investorsRelations = relations(investors, ({ one, many }) => ({
  user: one(users, {
    fields: [investors.userId],
    references: [users.id],
  }),
  investorUser: one(users, {
    fields: [investors.investorUserId],
    references: [users.id],
  }),
  loanInvestors: many(loanInvestors),
  transactions: many(transactions),
  debts: many(debts),
}));

export const loansRelations = relations(loans, ({ one, many }) => ({
  user: one(users, {
    fields: [loans.userId],
    references: [users.id],
  }),
  borrower: one(borrowers, {
    fields: [loans.borrowerId],
    references: [borrowers.id],
  }),
  loanContract: one(loanContracts, {
    fields: [loans.id],
    references: [loanContracts.loanId],
  }),
  loanInvestors: many(loanInvestors),
  loanWitnesses: many(loanWitnesses),
  userCommissions: many(loanUserCommissions),
  signingInvitations: many(loanSigningInvitations),
  transactions: many(transactions),
  groupLoans: many(loanGroupLoans),
}));

export const loanUserCommissionsRelations = relations(
  loanUserCommissions,
  ({ one }) => ({
    loan: one(loans, {
      fields: [loanUserCommissions.loanId],
      references: [loans.id],
    }),
    user: one(users, {
      fields: [loanUserCommissions.userId],
      references: [users.id],
    }),
  }),
);

export const loanContractsRelations = relations(
  loanContracts,
  ({ one, many }) => ({
    loan: one(loans, {
      fields: [loanContracts.loanId],
      references: [loans.id],
    }),
    signingInvitations: many(loanSigningInvitations),
  }),
);

export const loanSigningInvitationsRelations = relations(
  loanSigningInvitations,
  ({ one }) => ({
    loan: one(loans, {
      fields: [loanSigningInvitations.loanId],
      references: [loans.id],
    }),
    contract: one(loanContracts, {
      fields: [loanSigningInvitations.contractId],
      references: [loanContracts.id],
    }),
    investor: one(investors, {
      fields: [loanSigningInvitations.investorId],
      references: [investors.id],
    }),
    witness: one(witnesses, {
      fields: [loanSigningInvitations.witnessId],
      references: [witnesses.id],
    }),
  }),
);

export const loanInvestorsRelations = relations(
  loanInvestors,
  ({ one, many }) => ({
    loan: one(loans, {
      fields: [loanInvestors.loanId],
      references: [loans.id],
    }),
    investor: one(investors, {
      fields: [loanInvestors.investorId],
      references: [investors.id],
    }),
    interestPeriods: many(interestPeriods),
    receivedPayments: many(receivedPayments),
  }),
);

export const receivedPaymentsRelations = relations(
  receivedPayments,
  ({ one }) => ({
    loanInvestor: one(loanInvestors, {
      fields: [receivedPayments.loanInvestorId],
      references: [loanInvestors.id],
    }),
    interestPeriod: one(interestPeriods, {
      fields: [receivedPayments.interestPeriodId],
      references: [interestPeriods.id],
    }),
  }),
);

export const interestPeriodsRelations = relations(
  interestPeriods,
  ({ one, many }) => ({
    loanInvestor: one(loanInvestors, {
      fields: [interestPeriods.loanInvestorId],
      references: [loanInvestors.id],
    }),
    linkedReceivedPayments: many(receivedPayments),
  }),
);

export const loanGroupsRelations = relations(loanGroups, ({ one, many }) => ({
  creator: one(users, {
    fields: [loanGroups.creatorUserId],
    references: [users.id],
  }),
  groupLoans: many(loanGroupLoans),
  members: many(loanGroupMembers),
  rules: many(loanGroupRules),
  calendar: one(groupCalendars, {
    fields: [loanGroups.id],
    references: [groupCalendars.groupId],
  }),
  telegram: one(groupTelegramSettings, {
    fields: [loanGroups.id],
    references: [groupTelegramSettings.groupId],
  }),
}));

export const loanGroupLoansRelations = relations(loanGroupLoans, ({ one }) => ({
  group: one(loanGroups, {
    fields: [loanGroupLoans.groupId],
    references: [loanGroups.id],
  }),
  loan: one(loans, {
    fields: [loanGroupLoans.loanId],
    references: [loans.id],
  }),
  addedBy: one(users, {
    fields: [loanGroupLoans.addedByUserId],
    references: [users.id],
  }),
}));

export const loanGroupMembersRelations = relations(
  loanGroupMembers,
  ({ one }) => ({
    group: one(loanGroups, {
      fields: [loanGroupMembers.groupId],
      references: [loanGroups.id],
    }),
    user: one(users, {
      fields: [loanGroupMembers.userId],
      references: [users.id],
    }),
  }),
);

export const loanGroupRulesRelations = relations(loanGroupRules, ({ one }) => ({
  group: one(loanGroups, {
    fields: [loanGroupRules.groupId],
    references: [loanGroups.id],
  }),
  createdBy: one(users, {
    fields: [loanGroupRules.createdByUserId],
    references: [users.id],
  }),
}));

export const groupCalendarsRelations = relations(groupCalendars, ({ one }) => ({
  group: one(loanGroups, {
    fields: [groupCalendars.groupId],
    references: [loanGroups.id],
  }),
}));

export const groupTelegramSettingsRelations = relations(
  groupTelegramSettings,
  ({ one }) => ({
    group: one(loanGroups, {
      fields: [groupTelegramSettings.groupId],
      references: [loanGroups.id],
    }),
    linkedBy: one(users, {
      fields: [groupTelegramSettings.linkedByUserId],
      references: [users.id],
    }),
  }),
);

export const telegramLinkTokensRelations = relations(
  telegramLinkTokens,
  ({ one }) => ({
    group: one(loanGroups, {
      fields: [telegramLinkTokens.groupId],
      references: [loanGroups.id],
    }),
  }),
);

export const groupNotificationLogRelations = relations(
  groupNotificationLog,
  ({ one }) => ({
    group: one(loanGroups, {
      fields: [groupNotificationLog.groupId],
      references: [loanGroups.id],
    }),
  }),
);

export const debtsRelations = relations(debts, ({ one, many }) => ({
  user: one(users, {
    fields: [debts.userId],
    references: [users.id],
  }),
  investor: one(investors, {
    fields: [debts.investorId],
    references: [investors.id],
  }),
  interestPeriods: many(debtInterestPeriods),
}));

export const debtInterestPeriodsRelations = relations(
  debtInterestPeriods,
  ({ one, many }) => ({
    debt: one(debts, {
      fields: [debtInterestPeriods.debtId],
      references: [debts.id],
    }),
    receivedPayments: many(debtReceivedPayments),
  }),
);

export const debtReceivedPaymentsRelations = relations(
  debtReceivedPayments,
  ({ one }) => ({
    debtInterestPeriod: one(debtInterestPeriods, {
      fields: [debtReceivedPayments.debtInterestPeriodId],
      references: [debtInterestPeriods.id],
    }),
  }),
);

export const transactionsRelations = relations(transactions, ({ one }) => ({
  user: one(users, {
    fields: [transactions.userId],
    references: [users.id],
  }),
  investor: one(investors, {
    fields: [transactions.investorId],
    references: [investors.id],
  }),
  loan: one(loans, {
    fields: [transactions.loanId],
    references: [loans.id],
  }),
}));

export const usersRelations = relations(users, ({ many }) => ({
  accounts: many(accounts),
  sessions: many(sessions),
  investors: many(investors),
  borrowers: many(borrowers),
  loans: many(loans),
  transactions: many(transactions),
  debts: many(debts),
  paymentMethods: many(paymentMethods),
  loanGroups: many(loanGroups),
  loanGroupMemberships: many(loanGroupMembers),
  loanUserCommissions: many(loanUserCommissions),
}));

export const paymentMethodsRelations = relations(paymentMethods, ({ one }) => ({
  user: one(users, {
    fields: [paymentMethods.userId],
    references: [users.id],
  }),
}));

export const accountsRelations = relations(accounts, ({ one }) => ({
  user: one(users, { fields: [accounts.userId], references: [users.id] }),
}));

export const sessionsRelations = relations(sessions, ({ one }) => ({
  user: one(users, { fields: [sessions.userId], references: [users.id] }),
}));
