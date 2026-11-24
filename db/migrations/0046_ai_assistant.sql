-- AI assistant (chat over lending data). Additive only.
-- See docs/architecture/ai-assistant.md and docs/workflow/for-testing/ai-assistant-chatbot.md

CREATE TABLE IF NOT EXISTS ai_conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id text NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  agent text NOT NULL DEFAULT 'assistant',
  title text NOT NULL DEFAULT 'New chat',
  pinned_context jsonb,
  created_at timestamp NOT NULL DEFAULT now(),
  updated_at timestamp NOT NULL DEFAULT now(),
  archived_at timestamp,
  deleted_at timestamp
);

CREATE INDEX IF NOT EXISTS ai_conversations_user_updated_idx
  ON ai_conversations (user_id, updated_at);

CREATE TABLE IF NOT EXISTS ai_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES ai_conversations(id) ON DELETE CASCADE,
  user_id text NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('user', 'assistant')),
  status text NOT NULL DEFAULT 'complete'
    CHECK (status IN ('streaming', 'complete', 'aborted', 'error')),
  text text NOT NULL DEFAULT '',
  blocks jsonb NOT NULL DEFAULT '[]'::jsonb,
  attachments jsonb NOT NULL DEFAULT '[]'::jsonb,
  tool_trace jsonb NOT NULL DEFAULT '[]'::jsonb,
  prompt_id text,
  prompt_version text,
  model text,
  provider text,
  rounds integer NOT NULL DEFAULT 0,
  tokens_in integer NOT NULL DEFAULT 0,
  tokens_out integer NOT NULL DEFAULT 0,
  est_cost_usd numeric(10, 6) NOT NULL DEFAULT 0,
  latency_breakdown jsonb,
  guard_mode text,
  feedback smallint,
  feedback_reason text,
  created_at timestamp NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ai_messages_conversation_created_idx
  ON ai_messages (conversation_id, created_at);

CREATE TABLE IF NOT EXISTS ai_tool_calls (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id uuid NOT NULL REFERENCES ai_messages(id) ON DELETE CASCADE,
  user_id text NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  tool text NOT NULL,
  args_hash text NOT NULL,
  ok boolean NOT NULL,
  error_code text,
  row_count integer NOT NULL DEFAULT 0,
  truncated boolean NOT NULL DEFAULT false,
  latency_ms integer NOT NULL DEFAULT 0,
  created_at timestamp NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ai_tool_calls_tool_created_idx
  ON ai_tool_calls (tool, created_at);

ALTER TABLE ai_usage_events
  ADD COLUMN IF NOT EXISTS conversation_id uuid,
  ADD COLUMN IF NOT EXISTS message_id uuid,
  ADD COLUMN IF NOT EXISTS rounds integer,
  ADD COLUMN IF NOT EXISTS tool_calls integer;
