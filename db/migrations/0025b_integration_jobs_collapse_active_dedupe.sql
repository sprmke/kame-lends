-- Collapse leftover pending/running rows that share a dedupe_key.
-- 0020's unique index only covered status = 'pending', so a running row
-- plus a later pending (or two running) can collide. 0026 widens the
-- unique index to both statuses and needs a single survivor first.

WITH ranked AS (
  SELECT
    id,
    row_number() OVER (
      PARTITION BY dedupe_key
      ORDER BY
        CASE status WHEN 'running' THEN 0 ELSE 1 END,
        id DESC
    ) AS rn
  FROM integration_jobs
  WHERE status IN ('pending', 'running')
    AND dedupe_key IS NOT NULL
)
UPDATE integration_jobs AS extra
SET
  status = 'failed',
  last_error = 'superseded: duplicate active dedupe_key before unique index',
  updated_at = NOW()
FROM ranked
WHERE extra.id = ranked.id
  AND ranked.rn > 1;
