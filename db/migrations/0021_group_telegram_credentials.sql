-- Per-group Telegram bot token + message templates (kame-homes-style credentials).
ALTER TABLE group_telegram_settings
  ADD COLUMN IF NOT EXISTS bot_token text,
  ADD COLUMN IF NOT EXISTS templates jsonb NOT NULL DEFAULT '{}'::jsonb;
