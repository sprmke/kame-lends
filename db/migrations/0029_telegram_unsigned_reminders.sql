-- Hourly unsigned-contract Telegram reminders, per group.
ALTER TABLE group_telegram_settings
  ADD COLUMN IF NOT EXISTS notify_unsigned boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS signing_reminder_interval_hours integer NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS require_borrower_signature boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS require_investor_signature boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS require_witness_signature boolean NOT NULL DEFAULT false;
