CREATE TABLE IF NOT EXISTS loan_group_default_witnesses (
  id serial PRIMARY KEY,
  group_id integer NOT NULL REFERENCES loan_groups(id) ON DELETE CASCADE,
  witness_id integer NOT NULL REFERENCES witnesses(id) ON DELETE CASCADE,
  auto_sign boolean NOT NULL DEFAULT false,
  position integer NOT NULL DEFAULT 0,
  created_at timestamp NOT NULL DEFAULT now(),
  UNIQUE (group_id, witness_id)
);

CREATE INDEX IF NOT EXISTS loan_group_default_witnesses_group_idx
  ON loan_group_default_witnesses (group_id);
