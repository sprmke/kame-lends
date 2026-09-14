-- Multiple payment receipts per disbursement and received payment.
-- Backfills the new jsonb array from the legacy single-image columns.

ALTER TABLE "loan_investors"
  ADD COLUMN IF NOT EXISTS "receipts" jsonb NOT NULL DEFAULT '[]'::jsonb;

ALTER TABLE "received_payments"
  ADD COLUMN IF NOT EXISTS "receipts" jsonb NOT NULL DEFAULT '[]'::jsonb;

UPDATE "loan_investors"
SET "receipts" = jsonb_build_array(
  jsonb_strip_nulls(
    jsonb_build_object(
      'imageUrl', "receipt_image_url",
      'extractedData', "receipt_extracted_data"
    )
  )
)
WHERE "receipt_image_url" IS NOT NULL
  AND btrim("receipt_image_url") <> ''
  AND ("receipts" IS NULL OR "receipts" = '[]'::jsonb);

UPDATE "received_payments"
SET "receipts" = jsonb_build_array(
  jsonb_strip_nulls(
    jsonb_build_object(
      'imageUrl', "receipt_image_url",
      'extractedData', "receipt_extracted_data"
    )
  )
)
WHERE "receipt_image_url" IS NOT NULL
  AND btrim("receipt_image_url") <> ''
  AND ("receipts" IS NULL OR "receipts" = '[]'::jsonb);
