# ARES Web-Native Development Blueprint (Consolidated)

This document consolidates everything from our discussion beginning at your prompt about going fully web-native through the latest architecture, pricing, and agentic hierarchy decisions.

## 1) Final Direction We Agreed On

### Core product direction
- ARES becomes fully web-native.
- Frontend (`apps/web`) is the primary user interface.
- Backend APIs power all user actions.
- Agent execution/tooling is handled by worker infrastructure (not browser).
- CLI is removed from primary development scope (and later removed in implementation path).

### Deployment direction
- Runtime target: Kubernetes distributed workers (not single VPS-only worker pool).
- Data services: managed Postgres + managed Redis.
- Execution model: queue-driven async agent workers + API orchestration.

### Auth/Billing direction
- Web3-first login using Solana wallet SIWS (Sign-In With Solana / CAIP-122).
- Wallet-based tiers + quota + credit model.
- Pricing/usage inspired by modern AI products (clear tiers, quota, top-ups, usage tracking).

### Scope model for large skill system
- For 80+ skills, choose MVP-first rollout (not full catalog all at once).
- Build hierarchy and platform first, then onboard skills in waves.

## 2) What We Explicitly Chose (and What We Rejected)

### Chosen
- Web-native primary surface.
- Solana-only v1 wallet auth.
- K8s distributed worker architecture.
- MVP-first skill onboarding.
- Hybrid billing (quota + credits + metered usage).
- Agent hierarchy redesign (5-tier target).

### Not chosen / excluded for now
- Multi-chain auth (EVM + Solana) in v1.
- "Wire all 80+ skills in one phase."
- Card-first off-chain billing as primary path (can be added later as bridge).
- Keeping CLI as active first-class UX (web is primary).
- Flat 6-agent orchestrator as final architecture.

## 3) Product Vision (Web-Native)

ARES should function like:
- A modern AI security platform UX (dashboard + reports + console + billing).
- With Web3-native identity/payment rails.
- Backed by high-performance, policy-controlled, distributed agent workers.
- With deterministic API contracts and production-safe behavior.

## 4) End-to-End User Experience

### UX Flow (target)
1. User lands on marketing/pricing page.
2. Connect wallet (Solana).
3. SIWS challenge/sign/verify.
4. Session cookie issued.
5. User enters dashboard.
6. User consumes free quota or paid credits.
7. User runs chat/scan/report workflows.
8. If quota exhausted -> choose tier/top-up.
9. Wallet sends USDC payment with attribution memo.
10. Webhook credits wallet.
11. User continues with unlocked usage.

### UX states required
- Anonymous preview state.
- Authenticated free state.
- Authenticated paid state.
- Quota-exhausted paywall state.
- Payment pending / confirmed state.
- Active run lifecycle state (queued/running/succeeded/failed).

## 5) System Architecture (Target)

### Planes
- Control plane: auth, policy, quota, pricing, routing, governance.
- Execution plane: coordinators/sub-agents/workers/tools.
- Data plane: Postgres, Redis, artifact storage, telemetry.
- Ingress plane: Web API + middleware + rate limiting.

### Core services
- `apps/web` for API + UI.
- Worker services (K8s deployments/jobs).
- `apps/chain-intake` for on-chain webhook ingestion.
- Optional `apps/mcp-server` for operator-facing integrations.
- Shared engine/runtime packages for orchestration logic.

### Infra
- K8s cluster for worker elasticity.
- Managed Redis (rate-limit + nonce + queue).
- Managed Postgres (sessions, quota, credits, runs, findings).
- Artifact store (reports/evidence objects).
- Monitoring/logging/error tracking stack.

## 6) Auth Model (Web3-first, Solana)

### SIWS flow
- `POST /api/auth/challenge`
- wallet signs message
- `POST /api/auth/verify`
- server verifies signature + nonce + domain + expiry
- sets httpOnly session cookie
- `POST /api/auth/logout` clears session

### Session model
- JWT cookie signed by `ASST_SESSION_SECRET`.
- `SameSite=Lax`, `Secure` in production.
- short-lived nonce in Redis, single-use.

### Why this approach
- Lightweight, auditable, stable.
- Wallet-native.
- Avoid provider churn from third-party auth wrappers for v1.

## 7) Pricing, Quota, and Metering Strategy

### Hybrid best-practice model
Use:
- Tier quotas (free and plan guardrails).
- Credits (user-facing simplicity).
- Runtime metering (fair cost recovery for advanced models/tools).

### Suggested tiers
- Anonymous Preview: $0, minimal access.
- Wallet Free: $0, daily/monthly caps.
- Wallet Pro: paid monthly + credits.
- Wallet Sentinel: higher throughput + better queue priority.
- Enterprise Commander: custom/SLA.

### Unit metering formula
- `modelCost = ((inTokens * inRate) + (outTokens * outRate)) * modelMultiplier`
- `toolCost = Σ(toolBase + runtimeFactor * toolRuntimeMs + dataFactor * payloadSize)`
- `infraCost = requestBase + queueWorkerSurcharge`
- `rawUnits = modelCost + toolCost + infraCost`
- `billedUnits = max(operationMinUnits, rawUnits)`

### Operation minimums (starting defaults)
- Chat: 1
- Scan: 10
- Report: 2
- Premium tool runs: 2-8

### Guardrails
- per-request spend cap
- per-wallet daily spend cap
- per-tool cap
- concurrency caps by tier
- refund-on-failure policy for pending debits

## 8) Per-Tool Cost Matrix (Agreed Direction)

### Class model
- Class A (Light): low base + low runtime factor
- Class B (Standard)
- Class C (Heavy)
- Class D (Premium)

### Mapped examples (from discussion)
- A: git/rpc summaries
- B: account analyzers/upgrade monitors
- C: semgrep, graph mapping, secret scans
- D: manifest writer, full synthesis/report generation

This should be codified in `pricing.ts` and persisted via versioned pricing catalog in DB.

## 9) Billing and Credit Lifecycle

### Top-up flow
1. User selects bundle.
2. API returns treasury + memo payload.
3. Wallet sends USDC.
4. Helius webhook received by chain-intake.
5. Deposit verified + attributed.
6. `credits_ledger` credited (SETTLED).
7. UI balance updates and usage continues.

### Consumption flow
1. pre-check session/rate/quota
2. create provisional debit (PENDING)
3. execute operation
4. settle real cost (SETTLED) or refund (REFUNDED)

## 10) Data Model You Need

Minimum required tables/views:
- `wallets`
- `sessions` (optional if pure JWT + revocation strategy externalized)
- `tier_limits`
- `quota_counters`
- `pricing_catalog` (versioned)
- `usage_events` (token/tool/runtime telemetry)
- `credits_ledger` (append-only)
- `wallet_balance_view` (derived/materialized)
- `runs`
- `findings`
- `reports`
- `webhook_events` / `unallocated_deposits` (for replay/manual ops)

## 11) API Surface to Build

### Auth
- `/api/auth/challenge`
- `/api/auth/verify`
- `/api/auth/logout`
- `/api/auth/me`

### Billing
- `/api/billing/bundles`
- `/api/billing/prepare`
- `/api/billing/balance`
- `/api/billing/history`

### Runtime
- `/api/chat`
- `/api/scan`
- `/api/runs`
- `/api/findings`
- `/api/reports`
- `/api/console/stream`

### Admin (wallet allowlist)
- `/api/admin/wallet/:addr`
- `/api/admin/adjust`

All APIs must return deterministic response envelopes with request IDs.

## 12) Agentic Modelling Target (Hierarchy)

Requested hierarchy:
- Level 1: Orchestrator (root command)
- Level 2: Supervisor (domain oversight)
- Level 3: Coordinator (task routing/decomposition)
- Level 4: Sub-agent (domain executor)
- Level 5: Worker (tool-level execution)

Domains:
- Blockchain
- Web
- AI
- Reverse Engineering

This hierarchy is the target design.

## 13) Current State vs Target (Critical Gap)

Current orchestrator (`packages/engine/src/sub-agents.ts`) is:
- flat sub-agent config list
- no supervisor/coordinator levels
- no dedicated worker-tier runtime
- no distributed hierarchical scheduling

Therefore, the current model is not yet aligned with your requested 5-tier daemon architecture.

## 14) 80+ Skills Strategy (How to Make It Real)

Given complexity, the agreed approach is:
- MVP-first waves
- Build platform/runtime contracts first
- Onboard skills in validated batches

### Wave approach
- Wave A: 12-15 highest-impact skills (cross-domain core)
- Wave B/C: expand by domain priority and telemetry evidence
- Full catalog after stable orchestration, metering, and policy controls

## 15) Required Platform Capabilities Before Full Skill Scale

- Skill registry + metadata schema
- Adapter framework for heterogeneous skills/tools
- Capability graph for coordinator routing
- Cost-aware planner
- Policy engine (tier/skill/tool permissions)
- Traceability (request -> supervisor -> coordinator -> worker -> cost)

## 16) K8s Execution Design (Chosen)

Need:
- queue-backed job dispatch
- worker deployments per capability family
- autoscaling by queue depth and runtime
- DLQ/retry/idempotency
- per-job timeout and cancellation
- network policies and secret scopes
- cost and token telemetry from workers

## 17) Security and Governance Requirements

- Route-level auth + rate-limit everywhere
- Path safety and repository boundary checks
- No unbounded user-controlled execution contexts
- Strict tool permissions by class and tier
- Admin actions require elevated verification
- On-chain deposit attribution checks and replay protection

## 18) Observability Requirements

- request ID through entire stack
- structured logs (API + workers + intake)
- traces by run ID
- metrics:
  - p95 latency
  - queue lag
  - success/failure by worker
  - credits debited/refunded
  - cost drift (estimated vs actual)
- alerting:
  - queue backlog
  - failure spikes
  - webhook failures
  - abnormal spend

## 19) Development Program (Execution Plan)

- P0: Architecture contracts + schemas
  - finalize hierarchy contracts
  - finalize billing schema + metering spec
- P1: SIWS auth + middleware
  - challenge/verify/logout/me
  - nonce store + cookie sessions
- P2: Quota + billing core
  - credits ledger + balance + bundles + prepare
  - metered debit/refund path
- P3: Queue + worker runtime on K8s
  - async scans and worker orchestration
- P4: Hierarchical orchestrator runtime
  - supervisors/coordinators/sub-agents/workers
- P5: Skill registry + wave A onboarding
  - 12-15 core skills integrated with policies and metering
- P6: Admin + observability + hardening
  - admin tools, auditability, full SLO monitoring
- P7: Wave B/C expansion
  - scale toward full catalog

## 20) Acceptance Criteria (Definition of Done)

- Web app is primary and complete for user workflows.
- Wallet-first login works reliably (SIWS).
- Pricing/quotas are enforced and auditable.
- Metering reflects real usage and prevents abuse.
- Async scans execute on K8s workers with traceability.
- Hierarchical orchestrator runtime is operational.
- Wave A skills are production-stable.
- SLOs and observability in place.
- Security controls validated (authz, path safety, replay, rate limiting).

## 21) Explicitly Excluded from This Build (for now)

- Multi-chain wallet login (EVM) in v1
- One-shot 80+ skill rollout
- Card-first billing as primary rail
- Legacy CLI-first user journey
- Keeping flat orchestration as end-state

## 22) Practical Next Step (Immediate)

To start implementation safely, the next artifacts should be:

1. Architecture Contract Spec v1
   - interfaces for orchestrator/supervisor/coordinator/sub-agent/worker
2. Billing & Metering Spec v1
   - pricing catalog schema + debit/refund lifecycle + per-tool class mapping
3. Wave A Skill Manifest
   - selected 12-15 skills with adapters, tool needs, cost class, policy class

This gives engineering a stable, buildable foundation before code explosion.
