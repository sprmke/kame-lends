-- Auth.js session callback and Drizzle adapter select user.role.
-- Stale branches (e.g. develop) may still lack the enum and column.

DO $$ BEGIN
  CREATE TYPE "user_role" AS ENUM ('admin', 'investor');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE "user" ADD COLUMN IF NOT EXISTS "role" "user_role" NOT NULL DEFAULT 'admin';
