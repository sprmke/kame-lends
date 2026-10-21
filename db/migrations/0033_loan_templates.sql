CREATE TABLE IF NOT EXISTS "loan_templates" (
  "id" serial PRIMARY KEY,
  "user_id" text NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
  "name" text NOT NULL,
  "loan_name" text NOT NULL,
  "name_mode" text NOT NULL DEFAULT 'static',
  "type" "loan_type" NOT NULL,
  "borrower_id" integer REFERENCES "borrowers"("id") ON DELETE SET NULL,
  "group_ids" jsonb NOT NULL DEFAULT '[]'::jsonb,
  "interest_type" "interest_type" NOT NULL DEFAULT 'rate',
  "interest_value" numeric(15, 2) NOT NULL DEFAULT 10,
  "term_days" integer,
  "notes" text,
  "free_lot_sqm" integer,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL,
  CONSTRAINT "loan_templates_name_mode_check" CHECK ("name_mode" IN ('static', 'date_range')),
  CONSTRAINT "loan_templates_term_days_check" CHECK ("term_days" IS NULL OR "term_days" > 0)
);

CREATE UNIQUE INDEX IF NOT EXISTS "loan_templates_user_name_uidx"
  ON "loan_templates" ("user_id", "name");
