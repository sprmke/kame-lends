-- Prevent overlapping calendar (and other) integration jobs with the same dedupe_key
-- while one run is still in flight (status running), not only while pending.

DROP INDEX IF EXISTS integration_jobs_pending_dedupe_unique;

CREATE UNIQUE INDEX integration_jobs_active_dedupe_unique
  ON integration_jobs (dedupe_key)
  WHERE status IN ('pending', 'running')
    AND dedupe_key IS NOT NULL;
