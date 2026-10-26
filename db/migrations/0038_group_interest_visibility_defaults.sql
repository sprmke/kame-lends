ALTER TABLE loan_groups
  RENAME COLUMN show_interest_to_other_investors TO show_interest_to_investors;

ALTER TABLE loan_groups
  ADD COLUMN show_interest_to_owners boolean NOT NULL DEFAULT true;

ALTER TABLE loan_groups
  ALTER COLUMN show_interest_to_borrowers SET DEFAULT true,
  ALTER COLUMN show_interest_to_witnesses SET DEFAULT true,
  ALTER COLUMN show_interest_to_investors SET DEFAULT true;

UPDATE loan_groups
SET
  show_interest_to_owners = true,
  show_interest_to_investors = true,
  show_interest_to_borrowers = true,
  show_interest_to_witnesses = true;
