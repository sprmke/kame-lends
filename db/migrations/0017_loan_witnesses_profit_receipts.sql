-- Witness profit junction, borrower profit on loans, and receipt metadata on payments.
-- Required by the loan list/detail queries shipped after migration 0016.

ALTER TABLE "loans"
  ADD COLUMN IF NOT EXISTS "profit_type" "interest_type" NOT NULL DEFAULT 'rate';

ALTER TABLE "loans"
  ADD COLUMN IF NOT EXISTS "profit_value" numeric(15, 2) NOT NULL DEFAULT '0';

ALTER TABLE "loan_investors"
  ADD COLUMN IF NOT EXISTS "receipt_image_url" text;

ALTER TABLE "loan_investors"
  ADD COLUMN IF NOT EXISTS "receipt_extracted_data" jsonb;

ALTER TABLE "received_payments"
  ADD COLUMN IF NOT EXISTS "receipt_image_url" text;

ALTER TABLE "received_payments"
  ADD COLUMN IF NOT EXISTS "receipt_extracted_data" jsonb;

CREATE TABLE IF NOT EXISTS "loan_witnesses" (
  "id" serial PRIMARY KEY NOT NULL,
  "loan_id" integer NOT NULL REFERENCES "loans"("id") ON DELETE cascade,
  "witness_id" integer NOT NULL REFERENCES "witnesses"("id") ON DELETE cascade,
  "profit_type" "interest_type" NOT NULL DEFAULT 'rate',
  "profit_value" numeric(15, 2) NOT NULL DEFAULT '0',
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "loan_witnesses_loan_id_idx"
  ON "loan_witnesses" ("loan_id");

CREATE INDEX IF NOT EXISTS "loan_witnesses_witness_id_idx"
  ON "loan_witnesses" ("witness_id");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'loan_witnesses_loan_witness_unique'
  ) THEN
    ALTER TABLE "loan_witnesses"
      ADD CONSTRAINT "loan_witnesses_loan_witness_unique"
      UNIQUE ("loan_id", "witness_id");
  END IF;
END $$;
