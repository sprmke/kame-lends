-- Multi-role loan access: party login roles, borrower/witness user links,
-- authenticated signing (token/expiry optional for legacy rows).

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_enum e
    JOIN pg_type t ON e.enumtypid = t.oid
    WHERE t.typname = 'user_role' AND e.enumlabel = 'borrower'
  ) THEN
    ALTER TYPE "user_role" ADD VALUE 'borrower';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_enum e
    JOIN pg_type t ON e.enumtypid = t.oid
    WHERE t.typname = 'user_role' AND e.enumlabel = 'witness'
  ) THEN
    ALTER TYPE "user_role" ADD VALUE 'witness';
  END IF;
END $$;

ALTER TABLE "borrowers"
  ADD COLUMN IF NOT EXISTS "borrower_user_id" text
  REFERENCES "user"("id") ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS "borrowers_borrower_user_id_idx"
  ON "borrowers" ("borrower_user_id");

ALTER TABLE "witnesses"
  ADD COLUMN IF NOT EXISTS "witness_user_id" text
  REFERENCES "user"("id") ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS "witnesses_witness_user_id_idx"
  ON "witnesses" ("witness_user_id");

ALTER TABLE "loan_signing_invitations"
  ALTER COLUMN "token" DROP NOT NULL;

ALTER TABLE "loan_signing_invitations"
  ALTER COLUMN "expires_at" DROP NOT NULL;
