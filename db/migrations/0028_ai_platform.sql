-- AI gateway: usage log + per-user response cache (docs/architecture/ai-platform.md)

CREATE TABLE IF NOT EXISTS ai_usage_events (
  id serial PRIMARY KEY,
  user_id text REFERENCES "user"(id) ON DELETE SET NULL,
  feature text NOT NULL,
  provider text,
  model text,
  prompt_id text,
  prompt_version text,
  input_tokens integer NOT NULL DEFAULT 0,
  output_tokens integer NOT NULL DEFAULT 0,
  est_cost_usd numeric(10, 6) NOT NULL DEFAULT 0,
  latency_ms integer,
  status text NOT NULL,
  error_code text,
  fallback_used boolean NOT NULL DEFAULT false,
  cache_hit boolean NOT NULL DEFAULT false,
  created_at timestamp NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ai_usage_events_user_created_idx
  ON ai_usage_events (user_id, created_at);
CREATE INDEX IF NOT EXISTS ai_usage_events_created_idx
  ON ai_usage_events (created_at);

CREATE TABLE IF NOT EXISTS ai_response_cache (
  cache_key text PRIMARY KEY,
  user_id text NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  feature text NOT NULL,
  result jsonb NOT NULL,
  created_at timestamp NOT NULL DEFAULT now(),
  expires_at timestamp NOT NULL
);

CREATE INDEX IF NOT EXISTS ai_response_cache_expires_idx
  ON ai_response_cache (expires_at);
