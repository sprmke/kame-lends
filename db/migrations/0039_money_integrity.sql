-- Money integrity: audit events, soft delete, manual-completion fields, and
-- CHECK guards. Additive only.
CREATE TABLE IF NOT EXISTS money_audit_events (
  id serial PRIMARY KEY,
  at timestamptz NOT NULL DEFAULT now(),
  actor_user_id text REFERENCES "user"(id) ON DELETE SET NULL,
  entity_type text NOT NULL,
  entity_id integer,
  loan_id integer,
  action text NOT NULL,
  before jsonb,
  after jsonb,
  reason text
);
CREATE INDEX IF NOT EXISTS money_audit_events_loan_id_idx ON money_audit_events (loan_id, at DESC);
CREATE INDEX IF NOT EXISTS money_audit_events_entity_idx ON money_audit_events (entity_type, entity_id, at DESC);

ALTER TABLE loans ADD COLUMN IF NOT EXISTS deleted_at timestamptz;
ALTER TABLE received_payments ADD COLUMN IF NOT EXISTS deleted_at timestamptz;
ALTER TABLE loan_investors ADD COLUMN IF NOT EXISTS deleted_at timestamptz;
ALTER TABLE debts ADD COLUMN IF NOT EXISTS deleted_at timestamptz;
ALTER TABLE debt_received_payments ADD COLUMN IF NOT EXISTS deleted_at timestamptz;
CREATE INDEX IF NOT EXISTS loans_deleted_at_idx ON loans (deleted_at);
CREATE INDEX IF NOT EXISTS received_payments_deleted_at_idx ON received_payments (deleted_at);

ALTER TABLE loans ADD COLUMN IF NOT EXISTS completed_at timestamptz;
ALTER TABLE loans ADD COLUMN IF NOT EXISTS status_override text;
ALTER TABLE loans ADD COLUMN IF NOT EXISTS status_reason text;
ALTER TABLE loans ADD COLUMN IF NOT EXISTS waived_amount numeric(15, 2);

UPDATE loans l
SET completed_at = COALESCE(
  (SELECT max(rp.received_date) FROM received_payments rp JOIN loan_investors li ON li.id = rp.loan_investor_id WHERE li.loan_id = l.id),
  l.updated_at
)
WHERE l.status = 'Completed' AND l.completed_at IS NULL;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'loan_investors_amount_nonnegative') THEN
    ALTER TABLE loan_investors ADD CONSTRAINT loan_investors_amount_nonnegative CHECK (amount >= 0) NOT VALID;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'received_payments_amount_positive') THEN
    ALTER TABLE received_payments ADD CONSTRAINT received_payments_amount_positive CHECK (amount > 0) NOT VALID;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'interest_periods_rate_nonnegative') THEN
    ALTER TABLE interest_periods ADD CONSTRAINT interest_periods_rate_nonnegative CHECK (interest_rate >= 0) NOT VALID;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'loans_waived_amount_nonnegative') THEN
    ALTER TABLE loans ADD CONSTRAINT loans_waived_amount_nonnegative CHECK (waived_amount IS NULL OR waived_amount >= 0) NOT VALID;
  END IF;
END $$;
