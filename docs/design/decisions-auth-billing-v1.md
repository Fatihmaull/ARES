# Auth & billing — locked decisions (v1)

**Status:** LOCKED for implementation (replaces open questions in [public-web-auth-billing.md](./public-web-auth-billing.md) §11).

**Sign-off:** SIWS + JWT httpOnly cookie (draft §3) and memo-based USDC/SOL deposits via `apps/chain-intake` without an on-chain escrow program (draft §4) are **accepted** as the v1 approach.

---

## §11 — Resolved answers

| # | Topic | Decision |
|---|--------|----------|
| 1 | **Treasury custody** | Use a **simple hot treasury key** on dev/staging. Before **mainnet** production traffic, migrate to **Squads v4** (or equivalent) multisig; document treasury rotation in runbooks. |
| 2 | **Pricing unit** | **USDC-denominated bundles** with an internal **`ASST_UNITS`** credit abstraction (see [billing-metering-spec-v1.md](./billing-metering-spec-v1.md)). Prices shown to users match bundle USDC amounts; ledger stores units. |
| 3 | **Anonymous preview** | **Keep preview:** strict cap per [public-web-auth-billing.md](./public-web-auth-billing.md) §2 — **1 chat per day**, **no scans** for anonymous users. Reduces funnel friction; inference cost bounded by IP + rate limits. |
| 4 | **Quotas (free wallet)** | Adopt draft §2 placeholders until telemetry suggests otherwise: **10 chats / day**, **2 scans / month** for wallet-free tier. Tune via config/env without code changes where possible. |
| 5 | **Chain** | **Devnet-first** for P1–P7 integration and CI smoke tests; **single cluster config per deploy** (`mainnet-beta` vs `devnet` via env). Dual-deploy (simultaneous mainnet + devnet stacks) is **out of scope for v1** unless ops explicitly requests it. |
| 6 | **Refunds** | **Automated refund** on engine failure (`REFUNDED` ledger rows). **Manual admin refund/adjust** allowed via admin API for support (`reason=admin_adjust` / `refund` with audit `meta`). |
| 7 | **Session / wallet rotation** | **Separate principals per wallet address** for v1 — no balance merge UI or automatic linking. Document FAQ; future “merge” is a separate project (proof-of-ownership flow). |

---

## Revision history

| Date | Change |
|------|--------|
| 2026-04-27 | Initial lock for P0/P1 implementation |
