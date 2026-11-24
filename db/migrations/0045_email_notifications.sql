-- Email notification preferences and delivery log.
-- Preferences are per person. Delivery is keyed by normalized recipient email so
-- party emails that do not have an account yet can also be deduped and audited.

CREATE TABLE IF NOT EXISTS user_email_preferences (
  user_id TEXT PRIMARY KEY REFERENCES "user"(id) ON DELETE CASCADE,
  email_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  notify_activity BOOLEAN NOT NULL DEFAULT TRUE,
  notify_signing_requests BOOLEAN NOT NULL DEFAULT TRUE,
  notify_signing_reminders BOOLEAN NOT NULL DEFAULT TRUE,
  signing_reminder_first_after_days INTEGER NOT NULL DEFAULT 3,
  signing_reminder_repeat_every_days INTEGER NOT NULL DEFAULT 3,
  notify_due_reminders BOOLEAN NOT NULL DEFAULT TRUE,
  reminder_days INTEGER[] NOT NULL DEFAULT '{3,1}',
  notify_due_today BOOLEAN NOT NULL DEFAULT TRUE,
  notify_overdue BOOLEAN NOT NULL DEFAULT TRUE,
  overdue_repeat_every_days INTEGER NOT NULL DEFAULT 3,
  include_amounts BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT user_email_preferences_first_after_range
    CHECK (signing_reminder_first_after_days BETWEEN 0 AND 30),
  CONSTRAINT user_email_preferences_signing_repeat_range
    CHECK (signing_reminder_repeat_every_days BETWEEN 1 AND 30),
  CONSTRAINT user_email_preferences_overdue_repeat_range
    CHECK (overdue_repeat_every_days BETWEEN 1 AND 30),
  CONSTRAINT user_email_preferences_reminder_days_size
    CHECK (cardinality(reminder_days) BETWEEN 1 AND 5)
);

CREATE TABLE IF NOT EXISTS email_notification_log (
  id SERIAL PRIMARY KEY,
  user_id TEXT REFERENCES "user"(id) ON DELETE SET NULL,
  recipient_email TEXT NOT NULL,
  fingerprint TEXT NOT NULL,
  kind TEXT NOT NULL,
  status group_notification_status NOT NULL DEFAULT 'claimed',
  attempts INTEGER NOT NULL DEFAULT 0,
  error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  sent_at TIMESTAMPTZ,
  CONSTRAINT email_notification_log_recipient_fingerprint_unique
    UNIQUE (recipient_email, fingerprint)
);

CREATE INDEX IF NOT EXISTS email_notification_log_status_created_at_idx
  ON email_notification_log (status, created_at);

CREATE INDEX IF NOT EXISTS email_notification_log_recipient_email_idx
  ON email_notification_log (recipient_email);

CREATE INDEX IF NOT EXISTS email_notification_log_kind_idx
  ON email_notification_log (kind);
