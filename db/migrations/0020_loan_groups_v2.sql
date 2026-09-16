-- Loan Groups v2: derived membership, per-group calendar/Telegram, smart rules, job outbox.
-- Membership is fully derived from loan parties. Status enum is removed.

-- ---------------------------------------------------------------------------
-- 1.2 Data cleanup (before widening access under new rules)
-- ---------------------------------------------------------------------------

-- Drop group↔loan links where the loan is not owned by the group's creator,
-- unless the creator is a workspace owner (owns at least one loan).
DELETE FROM loan_group_loans lgl
USING loan_groups lg, loans l
WHERE lgl.group_id = lg.id
  AND lgl.loan_id = l.id
  AND l.user_id IS DISTINCT FROM lg.creator_user_id
  AND NOT EXISTS (
    SELECT 1 FROM loans owned WHERE owned.user_id = lg.creator_user_id LIMIT 1
  );

-- Non-active members are gone under derived membership.
DELETE FROM loan_group_members WHERE status IS DISTINCT FROM 'active';

-- ---------------------------------------------------------------------------
-- loan_groups: color + creator/name index
-- ---------------------------------------------------------------------------

ALTER TABLE "loan_groups"
  ADD COLUMN IF NOT EXISTS "color" text NOT NULL DEFAULT 'orange';

CREATE INDEX IF NOT EXISTS "loan_groups_creator_user_id_name_idx"
  ON "loan_groups" ("creator_user_id", "name");

-- ---------------------------------------------------------------------------
-- loan_group_loans: provenance
-- ---------------------------------------------------------------------------

ALTER TABLE "loan_group_loans"
  ADD COLUMN IF NOT EXISTS "added_by_user_id" text REFERENCES "user"("id") ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS "source" text NOT NULL DEFAULT 'manual';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'loan_group_loans_source_check'
  ) THEN
    ALTER TABLE "loan_group_loans"
      ADD CONSTRAINT "loan_group_loans_source_check"
      CHECK ("source" IN ('manual', 'rule'));
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- loan_group_members: drop status, add party_roles + synced_at
-- ---------------------------------------------------------------------------

ALTER TABLE "loan_group_members"
  ADD COLUMN IF NOT EXISTS "party_roles" text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS "synced_at" timestamp;

ALTER TABLE "loan_group_members" DROP COLUMN IF EXISTS "status";

DROP TYPE IF EXISTS "group_member_status";

-- ---------------------------------------------------------------------------
-- loan_group_rules (smart groups)
-- ---------------------------------------------------------------------------

DO $$ BEGIN
  CREATE TYPE "group_rule_party_type" AS ENUM ('investor', 'borrower');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "loan_group_rules" (
  "id" serial PRIMARY KEY NOT NULL,
  "group_id" integer NOT NULL REFERENCES "loan_groups"("id") ON DELETE cascade,
  "party_type" "group_rule_party_type" NOT NULL,
  "contact_id" integer NOT NULL,
  "created_by_user_id" text REFERENCES "user"("id") ON DELETE set null,
  "created_at" timestamp DEFAULT now() NOT NULL
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'loan_group_rules_group_party_contact_unique'
  ) THEN
    ALTER TABLE "loan_group_rules"
      ADD CONSTRAINT "loan_group_rules_group_party_contact_unique"
      UNIQUE ("group_id", "party_type", "contact_id");
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "loan_group_rules_party_contact_idx"
  ON "loan_group_rules" ("party_type", "contact_id");

CREATE INDEX IF NOT EXISTS "loan_group_rules_group_id_idx"
  ON "loan_group_rules" ("group_id");

-- ---------------------------------------------------------------------------
-- group_calendars
-- ---------------------------------------------------------------------------

DO $$ BEGIN
  CREATE TYPE "group_calendar_status" AS ENUM ('provisioning', 'active', 'error');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "group_calendars" (
  "group_id" integer PRIMARY KEY REFERENCES "loan_groups"("id") ON DELETE cascade,
  "google_calendar_id" text UNIQUE,
  "status" "group_calendar_status" NOT NULL DEFAULT 'provisioning',
  "last_event_sync_at" timestamp,
  "last_acl_sync_at" timestamp,
  "last_error" text,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);

-- ---------------------------------------------------------------------------
-- group_telegram_settings
-- ---------------------------------------------------------------------------

DO $$ BEGIN
  CREATE TYPE "group_telegram_status" AS ENUM ('disconnected', 'connected', 'bot_removed');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "group_telegram_settings" (
  "group_id" integer PRIMARY KEY REFERENCES "loan_groups"("id") ON DELETE cascade,
  "chat_id" text,
  "chat_title" text,
  "chat_type" text,
  "status" "group_telegram_status" NOT NULL DEFAULT 'disconnected',
  "enabled" boolean NOT NULL DEFAULT true,
  "notify_upcoming" boolean NOT NULL DEFAULT true,
  "reminder_days" integer[] NOT NULL DEFAULT '{3,1}',
  "notify_due_today" boolean NOT NULL DEFAULT true,
  "notify_overdue" boolean NOT NULL DEFAULT true,
  "overdue_repeat_every_days" integer NOT NULL DEFAULT 1,
  "notify_daily_digest" boolean NOT NULL DEFAULT false,
  "notify_activity" boolean NOT NULL DEFAULT true,
  "include_amounts" boolean NOT NULL DEFAULT true,
  "linked_by_user_id" text REFERENCES "user"("id") ON DELETE set null,
  "linked_at" timestamp,
  "last_sent_at" timestamp,
  "last_error" text,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS "group_telegram_settings_chat_id_unique"
  ON "group_telegram_settings" ("chat_id")
  WHERE "chat_id" IS NOT NULL;

-- ---------------------------------------------------------------------------
-- telegram_link_tokens
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS "telegram_link_tokens" (
  "id" serial PRIMARY KEY NOT NULL,
  "group_id" integer NOT NULL REFERENCES "loan_groups"("id") ON DELETE cascade,
  "token_hash" text NOT NULL,
  "created_by_user_id" text REFERENCES "user"("id") ON DELETE set null,
  "expires_at" timestamp NOT NULL,
  "used_at" timestamp,
  "created_at" timestamp DEFAULT now() NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS "telegram_link_tokens_token_hash_unique"
  ON "telegram_link_tokens" ("token_hash");

CREATE INDEX IF NOT EXISTS "telegram_link_tokens_group_id_idx"
  ON "telegram_link_tokens" ("group_id");

-- ---------------------------------------------------------------------------
-- group_notification_log
-- ---------------------------------------------------------------------------

DO $$ BEGIN
  CREATE TYPE "group_notification_status" AS ENUM ('claimed', 'sent', 'failed');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "group_notification_log" (
  "id" serial PRIMARY KEY NOT NULL,
  "group_id" integer NOT NULL REFERENCES "loan_groups"("id") ON DELETE cascade,
  "fingerprint" text NOT NULL,
  "kind" text NOT NULL,
  "status" "group_notification_status" NOT NULL DEFAULT 'claimed',
  "attempts" integer NOT NULL DEFAULT 0,
  "telegram_message_id" text,
  "error" text,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "sent_at" timestamp
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'group_notification_log_group_fingerprint_unique'
  ) THEN
    ALTER TABLE "group_notification_log"
      ADD CONSTRAINT "group_notification_log_group_fingerprint_unique"
      UNIQUE ("group_id", "fingerprint");
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "group_notification_log_status_created_at_idx"
  ON "group_notification_log" ("status", "created_at");

-- ---------------------------------------------------------------------------
-- integration_jobs (outbox; group_id has no FK so delete jobs outlive the group)
-- ---------------------------------------------------------------------------

DO $$ BEGIN
  CREATE TYPE "integration_job_status" AS ENUM ('pending', 'running', 'done', 'failed');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "integration_jobs" (
  "id" bigserial PRIMARY KEY NOT NULL,
  "kind" text NOT NULL,
  "group_id" integer,
  "payload" jsonb NOT NULL DEFAULT '{}'::jsonb,
  "dedupe_key" text,
  "status" "integration_job_status" NOT NULL DEFAULT 'pending',
  "attempts" integer NOT NULL DEFAULT 0,
  "run_after" timestamp DEFAULT now() NOT NULL,
  "locked_at" timestamp,
  "last_error" text,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS "integration_jobs_pending_dedupe_unique"
  ON "integration_jobs" ("dedupe_key")
  WHERE "status" = 'pending' AND "dedupe_key" IS NOT NULL;

CREATE INDEX IF NOT EXISTS "integration_jobs_status_run_after_idx"
  ON "integration_jobs" ("status", "run_after");
