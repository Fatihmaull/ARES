# Billing & Metering Spec v1

**Status:** LOCKED baseline for ledger + quotas.

**Related:** [decisions-auth-billing-v1.md](./decisions-auth-billing-v1.md), [public-web-auth-billing.md](./public-web-auth-billing.md), [architecture-contract-spec-v1.md](./architecture-contract-spec-v1.md).

---

## 1. Credit unit

- **`ASST_UNITS`** — abstract integer debited/credited client-visible balance.
- **Bundles** sold for **USDC** (see `pricing.ts`): e.g. 100 units per 1 USDC; bonus tiers optional.
- Fiat pegging is **out of scope**; USD notionally aligns with USDC bundle prices.

---

## 2. Schema (Postgres)

Applied via [`apps/chain-intake/sql/003_billing.sql`](../../apps/chain-intake/sql/003_billing.sql) (single source of truth DDL).

### 2.1 `wallets`

| Column | Type | Notes |
|--------|------|--------|
| `address` | `TEXT PRIMARY KEY` | Base58 Solana pubkey |
| `tier` | `TEXT NOT NULL` | `free` \| `paid` (paid set on first settled credit) |
| `created_at` | `TIMESTAMPTZ` | Default `NOW()` |

### 2.2 `credits_ledger` (append-only)

| Column | Type | Notes |
|--------|------|--------|
| `id` | `BIGSERIAL` | |
| `wallet` | `TEXT` | FK `wallets(address)` — for anonymous quota use empty sentinel and `ip` below |
| `direction` | `TEXT` | `CREDIT` \| `DEBIT` |
| `units` | `BIGINT` | Always positive magnitude |
| `reason` | `TEXT` | `deposit` \| `chat` \| `scan` \| `refund` \| `admin_adjust` \| … |
| `status` | `TEXT` | `PENDING` \| `SETTLED` \| `REFUNDED` |
| `related_tx_sig` | `TEXT` | Solana signature if deposit |
| `related_run_id` | `TEXT` | Engine/run correlation |
| `meta` | `JSONB` | Audit details |
| `created_at` | `TIMESTAMPTZ` | |
| `settled_at` | `TIMESTAMPTZ` | When status terminal |

**Balance:** `SUM(units)` for `CREDIT SETTLED` minus `DEBIT SETTLED` per wallet.

### 2.3 `quota_counters` (free + anonymous)

| Column | Type | Notes |
|--------|------|--------|
| `wallet` | `TEXT` | `''` for anonymous |
| `ip` | `INET` | Required for anonymous buckets |
| `window_kind` | `TEXT` | e.g. `anon_chat_daily`, `wallet_chat_daily`, `wallet_scan_monthly` |
| `window_start` | `TIMESTAMPTZ` | Period bucket start (UTC date or month truncate) |
| `count` | `INT` | |

**Primary key:** `(wallet, ip, window_kind, window_start)` — aligns with draft §4.

### 2.4 `pricing_catalog` (future versioned catalog)

v1: constants live in **`apps/web/lib/billing/pricing.ts`**. Schema reserved for later:

- `id`, `version`, `effective_at`, `json` catalog blob OR normalized rows.

Tool-class matrix (blueprint §8) moves into catalog when **`pricing_catalog`** is activated.

---

## 3. Operation costs (v1 constants)

| Action | Billing mode | Units (if paid) |
|--------|----------------|-----------------|
| Anonymous chat | Quota only | N/A |
| Wallet free chat | Quota | 0 |
| Wallet paid chat | Debit | 1 |
| Anonymous scan | **Denied** | — |
| Wallet free scan | Quota | 0 |
| Wallet paid scan | Debit | 10 |

Premium flows may raise debit multiples via `meta.multiplier` later.

---

## 4. Debit / refund lifecycle

1. **Pre-check:** session + rate limits + quota OR (`tier=paid` and balance ≥ minimum).
2. **Provisional:** insert `DEBIT` `PENDING` with `related_run_id` / `meta`.
3. **Execute** engine call.
4. **Settle:** `PENDING` → `SETTLED` with optional true-up `units` adjustment in `meta`.
5. **Failure:** `PENDING` → `REFUNDED` (row remains for audit).

Admin **manual** adjustments: `CREDIT` or `DEBIT` rows `reason=admin_adjust`, `SETTLED`, `meta.actor`.

---

## 5. Deposits (legacy memo rail — fallback only after PayAI ships)

- **Memo format:** `ASST:<userWallet>:<bundleId>:<clientNonce>` (draft §4).
- **Settlement:** Insert `CREDIT` `SETTLED`; upsert `wallets`; set `tier='paid'` if not already.
- **Replay:** Unique `(related_tx_sig)` partial index where sig not null prevents double credit.
- **Bad memo / wrong source:** Log + optional `unallocated_deposits` table future; v1 skip insert.

---

## 6. PayAI / x402 cash-in rail (PRIMARY)

PayAI ([payai.network](https://payai.network/), [docs](https://docs.payai.network/introduction)) is the **primary** payment rail. ARES still owns the **bundle → credit** mapping; PayAI never sets unit math.

### 6.1 SKU table (DB-driven, v1 superset)

| `sku_id` | Bundle | USDC | Units credited | Tier flip |
|----------|--------|------|----------------|-----------|
| `starter` | 100 units | 1 | 100 | `paid` |
| `growth` | 1,100 units (10% bonus) | 10 | 1100 | `paid` |
| `premium-pack` | 12,000 units + premium SKU access | 100 | 12000 | `premium` (90 days) |

`premium-pack` is what unlocks cost-class **D** workers/skills. The mapping lives in `pricing_catalog` (migration `007`) and is loaded at boot.

### 6.2 Purchase lifecycle

1. `POST /api/billing/prepare` — server creates `purchases` row `(status='PENDING', payai_payment_id=null)`, returns PayAI/x402 client params + the internal `purchase_id` as the correlation key.
2. User pays through PayAI on their wallet / facilitator client.
3. `POST /api/billing/webhooks/payai` — server verifies signature, locks idempotency on `payment_provider_events.idempotency_key`, looks up the `purchases` row by correlation, asserts amount/SKU match, then:
    - Updates `purchases.status='SETTLED'`, `payai_payment_id` set, `settled_at=now()`.
    - Inserts `credits_ledger` `CREDIT SETTLED` for the SKU's `units_credited` with `reason='deposit_payai'`, `meta={ skuId, payaiPaymentId }`.
    - Upserts `wallets.tier` per SKU's tier flip rule.

### 6.3 Idempotency

- `payment_provider_events.idempotency_key` is a unique index. PayAI retries land on the same row, **no second credit**.
- `purchases.payai_payment_id` is unique. Cross-checks any double-settle attempt.

### 6.4 Reconciliation

- A daily Vercel Cron job hits `GET /api/admin/reconcile-payai` (admin allowlist) which compares `purchases.status='SETTLED'` rows against PayAI's settlement export for the previous 24h window.
- Variances (orphan settlements, missing webhooks) emit Sentry alerts and create `unallocated_deposits` rows for human triage.

### 6.5 Hard invariants

- ARES **never** consults PayAI per token or per tool call. Section 7-8 of the blueprint (model/tool/infra cost formulas, operation minimums, guardrails) is unchanged.
- A failed engine call still **refunds** the provisional `DEBIT PENDING` per §4 here, regardless of how the credits were originally bought.

---

## 7. Schema additions (P1 migrations)

Files in [`apps/chain-intake/sql/`](../../apps/chain-intake/sql/):

### 7.1 `004_purchases.sql`

```
purchases (
  id UUID PRIMARY KEY,
  wallet TEXT NOT NULL REFERENCES wallets(address),
  sku_id TEXT NOT NULL,
  amount_usdc NUMERIC(20,6) NOT NULL,
  units_expected BIGINT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('PENDING','SETTLED','CANCELED','FAILED')),
  payai_payment_id TEXT UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  settled_at TIMESTAMPTZ,
  meta JSONB NOT NULL DEFAULT '{}'
)
```

### 7.2 `005_payment_provider_events.sql`

```
payment_provider_events (
  id BIGSERIAL PRIMARY KEY,
  provider TEXT NOT NULL DEFAULT 'payai',
  idempotency_key TEXT NOT NULL UNIQUE,
  raw JSONB NOT NULL,
  verified BOOLEAN NOT NULL,
  result TEXT NOT NULL CHECK (result IN ('CREDITED','IGNORED','REJECTED','PENDING')),
  related_purchase_id UUID REFERENCES purchases(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
)
```

### 7.3 `006_runs_findings_reports.sql`

`runs`, `findings`, `reports`, `report_artifacts` so [`apps/web/app/api/runs`](../../apps/web/app/api/runs), `findings`, `reports`, `reports/download` stop reading the local filesystem (P6).

### 7.4 `007_pricing_catalog.sql`

Versioned table holding SKUs, tier flips, tool cost classes, and worker base/runtime factors. Read at boot by `apps/web` and `apps/worker`.

---

## 8. Migration ownership

- DDL lives next to chain-intake migrations for operator simplicity.
- **Apply order:** `001_init.sql`, `002_triggers.sql`, `003_billing.sql`, `004_purchases.sql`, `005_payment_provider_events.sql`, `006_runs_findings_reports.sql`, `007_pricing_catalog.sql`.
- Script: `pnpm --filter @asst/chain-intake migrate` (or documented `psql -f`).

---

## 9. Revision history

| Date | Change |
|------|--------|
| 2026-04-27 | Initial v1 |
| 2026-05-05 | Add §6 PayAI primary cash-in rail, §7 P1 schema additions, premium SKU |
