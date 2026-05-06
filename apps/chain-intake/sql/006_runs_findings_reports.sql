-- Runs, findings, and reports persistence. Replaces filesystem-only assurance/ tree
-- so apps/web can serve runs/findings/reports without a shared local disk.
-- Apply after 005_payment_provider_events.sql.

CREATE TABLE IF NOT EXISTS runs (
  id TEXT PRIMARY KEY, -- ULID/UUID issued by web on enqueue
  wallet TEXT REFERENCES wallets (address), -- nullable for operator/anonymous runs
  kind TEXT NOT NULL CHECK (kind IN ('chat', 'scan', 'tool', 'report')),
  status TEXT NOT NULL CHECK (status IN ('queued', 'running', 'succeeded', 'failed', 'canceled')),
  target TEXT,
  model TEXT,
  request_id TEXT,
  related_debit_id BIGINT REFERENCES credits_ledger (id),
  units_billed BIGINT,
  trace JSONB NOT NULL DEFAULT '[]',
  meta JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  started_at TIMESTAMPTZ,
  finished_at TIMESTAMPTZ,
  error TEXT
);

CREATE INDEX IF NOT EXISTS runs_wallet_created_idx
  ON runs (wallet, created_at DESC);

CREATE INDEX IF NOT EXISTS runs_status_created_idx
  ON runs (status, created_at DESC);

CREATE TABLE IF NOT EXISTS findings (
  id BIGSERIAL PRIMARY KEY,
  run_id TEXT NOT NULL REFERENCES runs (id) ON DELETE CASCADE,
  agent TEXT NOT NULL,
  layer TEXT NOT NULL CHECK (layer IN ('orchestrator', 'supervisor', 'coordinator', 'sub_agent', 'worker')),
  severity TEXT NOT NULL CHECK (severity IN ('critical', 'high', 'medium', 'low', 'informational')),
  title TEXT NOT NULL,
  detail JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS findings_run_severity_idx
  ON findings (run_id, severity);

CREATE TABLE IF NOT EXISTS reports (
  id TEXT PRIMARY KEY, -- ULID/UUID
  run_id TEXT REFERENCES runs (id) ON DELETE SET NULL,
  wallet TEXT REFERENCES wallets (address),
  kind TEXT NOT NULL CHECK (kind IN ('pdf', 'sarif', 'json')),
  title TEXT NOT NULL,
  summary TEXT,
  meta JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS reports_wallet_created_idx
  ON reports (wallet, created_at DESC);

CREATE TABLE IF NOT EXISTS report_artifacts (
  id BIGSERIAL PRIMARY KEY,
  report_id TEXT NOT NULL REFERENCES reports (id) ON DELETE CASCADE,
  object_key TEXT NOT NULL, -- key in object storage (R2 / S3)
  bucket TEXT NOT NULL,
  bytes BIGINT NOT NULL CHECK (bytes >= 0),
  content_type TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS report_artifacts_report_idx
  ON report_artifacts (report_id);
