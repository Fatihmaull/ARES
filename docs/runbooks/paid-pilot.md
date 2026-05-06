# Paid Pilot Runbook

This runbook covers **P9** — the paid-pilot smoke and the 2-week PayAI
reconciliation that gates the public cutover.

Acceptance criteria come from blueprint **§20** and the spec extensions in
[billing-metering-spec-v1.md §6](../design/billing-metering-spec-v1.md).

## A. End-to-end smoke

Perform once per environment (staging then production) before opening to
external users.

1. **Connect wallet** (Phantom on Solana mainnet/devnet).
2. **Sign in** at `/api/auth/challenge` → wallet signs SIWS message → cookie set.
3. **Visit `/api/billing/balance`** — expect `tier=free`, `units=0`.
4. **Buy `starter` bundle** via PayAI:
   - `POST /api/billing/prepare { bundleId: "starter" }`
   - Response includes `rail: "payai"`, `purchaseId`, and either `checkoutUrl` or `x402` params.
   - Complete the payment in the wallet flow.
5. **Receive webhook** — verify within 60 seconds:
   ```sql
   SELECT result FROM payment_provider_events
    WHERE related_purchase_id = $purchase_id;
   ```
   Expect `CREDITED`.
6. **Re-check balance** — `tier=paid`, `units=100`.
7. **Run a scan**:
   - `POST /api/scan { target: "." }` → `status="queued"`, returns `runId`.
   - Wait for worker pickup (`/api/runs/<runId>` → `status` flips `queued → running → succeeded`).
   - Verify `units_billed=10` in `runs`, and `credits_ledger` has `DEBIT SETTLED`.
8. **Download a report** — `GET /api/reports/download?id=<reportId>`. The web
   route should 302-redirect to a signed R2 URL that the browser fetches.
9. **Ledger trail** — `GET /api/billing/history?limit=20` shows the `CREDIT
   SETTLED` deposit and `DEBIT SETTLED` scan in order.

## B. Negative tests

- **Invalid signature** — submit a hand-rolled webhook with a wrong signature.
  Expect 401, no row credited, `payment_provider_events` row absent.
- **Replay** — replay the same valid webhook twice (PayAI usually retries
  on 5xx). Expect exactly one `CREDIT` row; the second event lands as
  `IGNORED` per `idempotency_key`.
- **Free-tier scan abuse** — burn through free quota and expect 429 with
  message "Free-tier scan quota exceeded".
- **Premium tool on `paid` tier** — invoke a class-D skill from a paid
  wallet. Expect `policy_block` trace event, no debit.

## C. 2-week PayAI reconciliation (gate to public)

Run the daily reconciliation cron (already wired at `/api/admin/reconcile-payai`).

Each day:

1. Compare PayAI dashboard's settlement export to:
   ```sql
   SELECT COUNT(*) AS settled_purchases
     FROM purchases
    WHERE status = 'SETTLED'
      AND settled_at > now() - INTERVAL '24 hours';
   ```

2. Sample 20 random PayAI payment IDs and confirm each has a
   `credits_ledger` `CREDIT SETTLED` row with the correct units.

3. Verify zero `IGNORED` or `REJECTED` rows that aren't intentional
   replays. If any unexpected, follow [`payai-webhook-outage.md`](payai-webhook-outage.md).

After 14 consecutive clean days **and** a clean smoke run, set:
```
PAYAI_ENABLED_SKUS=starter,growth,premium-pack
```
in production Vercel env (matches the value in `.env.example`) — this is
already the default; the gate is operational confidence.

## D. Cutover steps (memo rail → PayAI default)

1. Confirm the smoke and reconciliation results above.
2. Tag a release `v1.0.0-paid-pilot` and deploy.
3. Update marketing copy on `/pricing` to remove any "fallback" language
   from PayAI (already PayAI-primary in this commit).
4. Keep memo rail behind `ASST_TREASURY_WALLET` for ~30 days as the
   emergency fallback. Remove the rail by clearing the env var when stable.

## E. Sign-off checklist (blueprint §20)

- [ ] Web app is primary and complete for user workflows.
- [ ] Wallet-first login works reliably (SIWS).
- [ ] PayAI top-up credits wallets with no double-spend on webhook retry.
- [ ] Metering reflects real usage and prevents abuse.
- [ ] Async scans execute on the worker with traceability.
- [ ] Hierarchical orchestrator runtime operational (registry, policy, planner).
- [ ] Wave A skills production-stable (15 skills enabled, gated by tier).
- [ ] SLOs and observability in place (Sentry across 3 services).
- [ ] Security controls validated (authz, path safety, replay, rate limiting).

When every box is checked, the pilot is signed off and the public cutover
is approved.
