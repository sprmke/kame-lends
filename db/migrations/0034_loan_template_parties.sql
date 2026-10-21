ALTER TABLE "loan_templates"
  ADD COLUMN IF NOT EXISTS "borrower_ids" jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS "investors" jsonb NOT NULL DEFAULT '[]'::jsonb;

UPDATE "loan_templates"
SET "borrower_ids" = jsonb_build_array("borrower_id")
WHERE "borrower_id" IS NOT NULL
  AND "borrower_ids" = '[]'::jsonb;
