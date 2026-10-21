ALTER TABLE "loan_investors" ADD COLUMN IF NOT EXISTS "notes" text;
ALTER TABLE "received_payments" ADD COLUMN IF NOT EXISTS "notes" text;
