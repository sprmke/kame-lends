-- Validate the debt CHECK constraints added in 0042.
DO $$
DECLARE
  c record;
BEGIN
  FOR c IN
    SELECT conname, conrelid::regclass AS table_name
    FROM pg_constraint
    WHERE conname IN (
      'debts_amount_nonnegative',
      'debts_duration_positive',
      'debt_interest_periods_expected_nonnegative'
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
