ALTER TABLE loan_groups
  ADD COLUMN show_interest_to_borrowers boolean NOT NULL DEFAULT false,
  ADD COLUMN show_interest_to_witnesses boolean NOT NULL DEFAULT false,
  ADD COLUMN show_interest_to_other_investors boolean NOT NULL DEFAULT false;
