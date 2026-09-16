-- Per-investor commission on a loan allocation (rate % of principal or fixed).

ALTER TABLE "loan_investors"
  ADD COLUMN IF NOT EXISTS "profit_type" "interest_type" NOT NULL DEFAULT 'rate';

ALTER TABLE "loan_investors"
  ADD COLUMN IF NOT EXISTS "profit_value" numeric(15, 2) NOT NULL DEFAULT '0';
