-- Workflow columns on findings (detections UI).

ALTER TABLE findings
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'open'
    CHECK (status IN ('open', 'acknowledged', 'resolved', 'wont_fix'));

ALTER TABLE findings
  ADD COLUMN IF NOT EXISTS resolved_at TIMESTAMPTZ;

ALTER TABLE findings
  ADD COLUMN IF NOT EXISTS resolved_by_wallet TEXT REFERENCES wallets (address);

ALTER TABLE findings
  ADD COLUMN IF NOT EXISTS notes TEXT;

UPDATE findings SET status = 'open' WHERE status IS NULL;
