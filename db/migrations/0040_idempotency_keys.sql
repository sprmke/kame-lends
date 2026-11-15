-- Idempotency keys for money-creating requests (DATA-09).
CREATE TABLE IF NOT EXISTS idempotency_keys (
  key text PRIMARY KEY,
  user_id text NOT NULL,
  route text NOT NULL,
  response_status integer,
  response_body jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idempotency_keys_created_at_idx
  ON idempotency_keys (created_at);
