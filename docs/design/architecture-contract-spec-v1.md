# Architecture Contract Spec v1

**Status:** LOCKED baseline for web execution boundaries.

**Related:** [ares-web-native-development-blueprint-consolidated.md](./ares-web-native-development-blueprint-consolidated.md), [public-web-auth-billing.md](./public-web-auth-billing.md) §7, [billing-metering-spec-v1.md](./billing-metering-spec-v1.md).

---

## 1. Planes (responsibilities)

| Plane | Owns | Does not own |
|-------|------|----------------|
| **Ingress** (`apps/web` routes + `middleware.ts`) | TLS termination assumptions, JWT cookie verification surface, coarse IP limits, request IDs | Long-running agent graphs |
| **Control** (`apps/web` `lib/auth`, `lib/billing`, `lib/ratelimit`) | Sessions, quotas, credits ledger writes, tier policy, admin allowlists | Tool execution |
| **Execution** (`@ares/engine` public orchestrator, future workers) | Agent graphs, tools, SARIF/findings emission | Wallet identity, pricing |
| **Data** (Postgres, Redis/Upstash, object storage later) | Durable ledger, quotas, nonces, rate-limit windows | Business logic |

**Invariant:** `@ares/engine` remains **billing- and wallet-agnostic**. Callers pass `model`, paths, and flags only. Metering callbacks (future) are optional hooks and must not require importing `apps/web`.

---

## 2. Identifiers

| ID | Issued by | Format | Propagation |
|----|-----------|--------|-------------|
| **requestId** | Ingress (header `x-request-id` or new UUID) | UUID string | Every JSON response envelope (`ok`, `requestId`, `data`/`error`) |
| **runId** | Execution plane when a run starts | Opaque string (engine/session id or ULID) | Returned to client for `/api/runs`, linked on ledger rows `related_run_id` when debiting |

Until K8s workers land, **sync** chat may use `requestId` as the only correlation; **scan** paths may allocate `runId` inside the orchestrator adapter when exposed.

---

## 3. Surface contracts

### 3.1 `apps/web` → `@ares/engine`

- **Inputs:** Same as today’s `createPublicOrchestrator()` factory — no wallet fields on engine instances.
- **Outputs:** Structured results / streamed tokens as implemented per route.
- **Failure:** HTTP layer maps thrown errors to `INTERNAL_ERROR` and triggers **billing refund** where a provisional debit exists (see billing spec).

### 3.2 `apps/web` ↔ Postgres (billing)

- Single **`DATABASE_URL`** shared with **`apps/chain-intake`** for `wallets`, `credits_ledger`, `quota_counters`, and existing chain tables.
- Web app owns **migration apply** for billing DDL (`apps/chain-intake/sql/003_billing.sql`); operators run migrations once per environment.

### 3.3 `apps/chain-intake` → Postgres (deposits)

- After ingesting Helius payloads, **deposit attribution** runs in-process and inserts **`credits_ledger`** `CREDIT` rows (`SETTLED`) when memo + treasury + source checks pass.
- No direct HTTP callback to `apps/web` required for v1; UI polls `/api/billing/balance`.

---

## 4. Sync vs async (target posture)

| Operation | v1 posture | Future (blueprint §16) |
|-----------|------------|------------------------|
| **Chat** | Synchronous HTTP; engine runs in-route | Same or optional worker for very long prompts |
| **Full scan** | Fire-and-forget start in-process (existing pattern) with client polling runs API | Queue-backed job; dedicated worker deployment |
| **Reports / heavy tools** | Same as scan where applicable | Autoscale on queue depth |

API responses must remain **deterministic envelopes** (`ok`, `requestId`, typed `error.code`).

---

## 5. Security boundaries

- **Anonymous** callers: strict route allowlist (`/api/chat` preview only per product policy) + IP limits.
- **Wallet session** callers: JWT required for scans and billing APIs; ledger debits keyed by `sub`.
- **Admin** callers: wallet in `ASST_ADMIN_WALLETS` plus valid session.
- **Operator bypass:** Optional `ASST_WEB_API_KEY` continues to authorize automation without ledger charges (existing behavior extended explicitly as non-customer traffic).

---

## 6. Revision history

| Date | Change |
|------|--------|
| 2026-04-27 | Initial v1 |
