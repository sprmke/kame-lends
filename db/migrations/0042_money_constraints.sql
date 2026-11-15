-- Validate the money CHECK constraints and add the period-date uniqueness
-- guard. Every step is conditional: production can apply this before the
-- repair has run, and a later pass finishes the work.

DO $$
DECLARE
  c record;
BEGIN
  FOR c IN
    SELECT conname, conrelid::regclass AS table_name
    FROM pg_constraint
    WHERE conname IN (
      'loan_investors_amount_nonnegative',
      'received_payments_amount_positive',
      'interest_periods_rate_nonnegative',
      'loans_waived_amount_nonnegative'
    )
      AND NOT convalidated
  LOOP
    BEGIN
      EXECUTE format('ALTER TABLE %s VALIDATE CONSTRAINT %I', c.table_name, c.conname);
    EXCEPTION WHEN others THEN
      RAISE NOTICE 'Skipped validation of %: %', c.conname, SQLERRM;
    END;
  END LOOP;
END $$;

-- Debt guards (additive, NOT VALID first for existing data).
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'debts_amount_nonnegative') THEN
    ALTER TABLE debts ADD CONSTRAINT debts_amount_nonnegative CHECK (amount >= 0) NOT VALID;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'debts_duration_positive') THEN
    ALTER TABLE debts ADD CONSTRAINT debts_duration_positive CHECK (duration_months > 0) NOT VALID;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'debt_interest_periods_expected_nonnegative') THEN
    ALTER TABLE debt_interest_periods
      ADD CONSTRAINT debt_interest_periods_expected_nonnegative
      CHECK (expected_interest >= 0) NOT VALID;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'interest_periods_loan_investor_due_date_unique') THEN
    IF EXISTS (
      SELECT 1
      FROM interest_periods
      GROUP BY loan_investor_id, due_date
      HAVING count(*) > 1
    ) THEN
      RAISE NOTICE 'Skipped unique period constraint: duplicate dates remain. Run the repair first.';
    ELSE
      ALTER TABLE interest_periods
        ADD CONSTRAINT interest_periods_loan_investor_due_date_unique
        UNIQUE (loan_investor_id, due_date);
    END IF;
  END IF;
END $$;
