-- The debt column stores the full installment (principal + interest), not
-- interest alone. Rename it so the name matches the value.
ALTER TABLE debt_interest_periods
  RENAME COLUMN expected_interest TO expected_installment;
