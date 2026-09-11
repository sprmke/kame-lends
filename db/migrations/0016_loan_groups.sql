-- Groups: user-created collections of loans, shared with the loans' parties.
-- Organizational only — does not grant loan access; hasLoanViewAccess stays the only gate.

DO $$ BEGIN
  CREATE TYPE "group_member_status" AS ENUM ('active', 'left', 'removed');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "loan_groups" (
  "id" serial PRIMARY KEY NOT NULL,
  "creator_user_id" text NOT NULL REFERENCES "user"("id") ON DELETE cascade,
  "name" text NOT NULL,
  "notes" text,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "loan_groups_creator_user_id_idx"
  ON "loan_groups" ("creator_user_id");

CREATE TABLE IF NOT EXISTS "loan_group_loans" (
  "id" serial PRIMARY KEY NOT NULL,
  "group_id" integer NOT NULL REFERENCES "loan_groups"("id") ON DELETE cascade,
  "loan_id" integer NOT NULL REFERENCES "loans"("id") ON DELETE cascade,
  "added_at" timestamp DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "loan_group_loans_group_id_idx"
  ON "loan_group_loans" ("group_id");

CREATE INDEX IF NOT EXISTS "loan_group_loans_loan_id_idx"
  ON "loan_group_loans" ("loan_id");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'loan_group_loans_group_loan_unique'
  ) THEN
    ALTER TABLE "loan_group_loans"
      ADD CONSTRAINT "loan_group_loans_group_loan_unique"
      UNIQUE ("group_id", "loan_id");
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS "loan_group_members" (
  "id" serial PRIMARY KEY NOT NULL,
  "group_id" integer NOT NULL REFERENCES "loan_groups"("id") ON DELETE cascade,
  "user_id" text NOT NULL REFERENCES "user"("id") ON DELETE cascade,
  "status" "group_member_status" NOT NULL DEFAULT 'active',
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "loan_group_members_group_id_idx"
  ON "loan_group_members" ("group_id");

CREATE INDEX IF NOT EXISTS "loan_group_members_user_id_idx"
  ON "loan_group_members" ("user_id");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'loan_group_members_group_user_unique'
  ) THEN
    ALTER TABLE "loan_group_members"
      ADD CONSTRAINT "loan_group_members_group_user_unique"
      UNIQUE ("group_id", "user_id");
  END IF;
END $$;
