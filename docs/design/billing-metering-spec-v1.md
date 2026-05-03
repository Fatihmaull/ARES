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

## 5. Deposits (`apps/chain-intake`)

- **Memo format:** `ASST:<userWallet>:<bundleId>:<clientNonce>` (draft §4).
- **Settlement:** Insert `CREDIT` `SETTLED`; upsert `wallets`; set `tier='paid'` if not already.
- **Replay:** Unique `(related_tx_sig)` partial index where sig not null prevents double credit.
- **Bad memo / wrong source:** Log + optional `unallocated_deposits` table future; v1 skip insert.

---

## 6. Migration ownership

- DDL lives next to chain-intake migrations for operator simplicity.
- **Apply order:** `001_init.sql`, `002_triggers.sql`, `003_billing.sql`.
- Script: `pnpm --filter @asst/chain-intake migrate` (or documented `psql -f`).

---

## 7. Revision history

| Date | Change |
|------|--------|
| 2026-04-27 | Initial v1 |
