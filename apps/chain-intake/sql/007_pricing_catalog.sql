-- Versioned pricing catalog: SKUs sold via PayAI plus tool/worker cost classes.
-- Apply after 006_runs_findings_reports.sql.

CREATE TABLE IF NOT EXISTS pricing_catalog (
  id BIGSERIAL PRIMARY KEY,
  version INT NOT NULL,
  effective_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  retired_at TIMESTAMPTZ,
  catalog JSONB NOT NULL,
  notes TEXT
);

CREATE UNIQUE INDEX IF NOT EXISTS pricing_catalog_version_uidx
  ON pricing_catalog (version);

CREATE INDEX IF NOT EXISTS pricing_catalog_active_idx
  ON pricing_catalog (effective_at DESC)
  WHERE retired_at IS NULL;

-- Seed the v1 catalog only when no catalog row exists yet.
INSERT INTO pricing_catalog (version, catalog, notes)
SELECT 1, $catalog$
{
  "skus": [
    {
      "id": "starter",
      "label": "100 units",
      "amountUsdc": 1,
      "unitsCredited": 100,
      "tier": "paid",
      "tierFlipDurationDays": null
    },
    {
      "id": "growth",
      "label": "1,100 units (10% bonus)",
      "amountUsdc": 10,
      "unitsCredited": 1100,
      "tier": "paid",
      "tierFlipDurationDays": null
    },
    {
      "id": "premium-pack",
      "label": "12,000 units + premium (90 days)",
      "amountUsdc": 100,
      "unitsCredited": 12000,
      "tier": "premium",
      "tierFlipDurationDays": 90
    }
  ],
  "operationMinUnits": {
    "chat": 1,
    "scan": 10,
    "report": 2,
    "premiumTool": 4
  },
  "toolClasses": {
    "A": { "base": 0, "runtimeFactor": 0 },
    "B": { "base": 0, "runtimeFactor": 1 },
    "C": { "base": 1, "runtimeFactor": 2 },
    "D": { "base": 2, "runtimeFactor": 4 }
  },
  "tierAllowedClasses": {
    "anon": ["A"],
    "free": ["A", "B"],
    "paid": ["A", "B", "C"],
    "premium": ["A", "B", "C", "D"]
  },
  "guardrails": {
    "perRequestSpendCapUnits": 500,
    "perWalletDailySpendCapUnits": 5000,
    "perToolCapUnits": 200,
    "concurrencyByTier": { "free": 1, "paid": 2, "premium": 4 }
  }
}
$catalog$::jsonb, 'Initial v1 catalog seeded by 007_pricing_catalog.sql'
WHERE NOT EXISTS (SELECT 1 FROM pricing_catalog);
