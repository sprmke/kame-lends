-- loan_signing_invitations is queried by loan_id on access checks and contract loads.
CREATE INDEX IF NOT EXISTS "loan_signing_invitations_loan_id_idx"
  ON "loan_signing_invitations" ("loan_id");
