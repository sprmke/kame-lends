-- Per-user commission on a loan (private to the user who set it).

CREATE TABLE IF NOT EXISTS "loan_user_commissions" (
  "id" serial PRIMARY KEY,
  "loan_id" integer NOT NULL REFERENCES "loans"("id") ON DELETE CASCADE,
  "user_id" text NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
  "profit_type" "interest_type" NOT NULL DEFAULT 'rate',
  "profit_value" numeric(15, 2) NOT NULL DEFAULT '0',
  "created_at" timestamp NOT NULL DEFAULT now(),
  "updated_at" timestamp NOT NULL DEFAULT now(),
  CONSTRAINT "loan_user_commissions_loan_user_unique" UNIQUE ("loan_id", "user_id")
);

CREATE INDEX IF NOT EXISTS "loan_user_commissions_user_id_idx"
  ON "loan_user_commissions" ("user_id");

CREATE INDEX IF NOT EXISTS "loan_user_commissions_loan_id_idx"
  ON "loan_user_commissions" ("loan_id");

-- Backfill borrower commission (loan-level profit).
INSERT INTO "loan_user_commissions" ("loan_id", "user_id", "profit_type", "profit_value")
SELECT l."id", b."borrower_user_id", l."profit_type", l."profit_value"
FROM "loans" l
INNER JOIN "borrowers" b ON b."id" = l."borrower_id"
WHERE b."borrower_user_id" IS NOT NULL
  AND l."profit_value"::numeric > 0
ON CONFLICT ("loan_id", "user_id") DO NOTHING;

-- Backfill investor commission (one row per user per loan).
INSERT INTO "loan_user_commissions" ("loan_id", "user_id", "profit_type", "profit_value")
SELECT DISTINCT ON (li."loan_id", i."investor_user_id")
  li."loan_id",
  i."investor_user_id",
  li."profit_type",
  li."profit_value"
FROM "loan_investors" li
INNER JOIN "investors" i ON i."id" = li."investor_id"
WHERE i."investor_user_id" IS NOT NULL
  AND li."profit_value"::numeric > 0
ORDER BY li."loan_id", i."investor_user_id", li."updated_at" DESC
ON CONFLICT ("loan_id", "user_id") DO NOTHING;

-- Backfill witness commission.
INSERT INTO "loan_user_commissions" ("loan_id", "user_id", "profit_type", "profit_value")
SELECT lw."loan_id", w."witness_user_id", lw."profit_type", lw."profit_value"
FROM "loan_witnesses" lw
INNER JOIN "witnesses" w ON w."id" = lw."witness_id"
WHERE w."witness_user_id" IS NOT NULL
  AND lw."profit_value"::numeric > 0
ON CONFLICT ("loan_id", "user_id") DO NOTHING;
