-- Cross-instance invalidation for the per-isolate memory cache (PERF-02).
CREATE TABLE IF NOT EXISTS cache_epochs (
  key text PRIMARY KEY,
  version integer NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO cache_epochs (key, version)
VALUES ('loans', 0)
ON CONFLICT (key) DO NOTHING;
