# Runbook: PayAI webhook outage

**Symptom:** Users report top-ups stuck in `PENDING`. PayAI dashboard shows
settlements completed; `purchases` rows still `PENDING`.

## Triage

1. Check `payment_provider_events` for the last 30 minutes:
   ```sql
   SELECT result, COUNT(*)
     FROM payment_provider_events
    WHERE provider = 'payai'
      AND created_at > now() - INTERVAL '30 minutes'
    GROUP BY result;
   ```
   - All `verified=false`: signature mismatch — secret rotated or wrong env.
   - No rows at all: webhook never reached us.

2. Check Vercel Function logs for `/api/billing/webhooks/payai` (status 4xx/5xx).

3. Check PayAI merchant dashboard for delivery failures.

## Mitigation

- **Signature mismatch:** confirm `PAYAI_WEBHOOK_SECRET` matches the secret
  configured in PayAI's merchant dashboard. After rotating, replay the failed
  events from PayAI's dashboard.

- **Vercel 5xx:** if Postgres is up, retry will work. If not, the worker is
  also disabled — fail over to the legacy memo rail by setting
  `PAYAI_ENABLED_SKUS=` to empty, then redeploy `apps/web`. The prepare route
  reverts to memo + treasury for new top-ups.

- **PayAI side outage:** existing pending purchases auto-cancel after their
  `expires_at` (30 min). Users see the cancellation in `/dashboard/billing`.

## Manual reconciliation

```sql
-- Force-credit a settled-but-unrecorded payment (operator only):
INSERT INTO credits_ledger (wallet, direction, units, reason, status, meta)
VALUES ($wallet, 'CREDIT', $units, 'manual_payai_recovery', 'SETTLED',
        jsonb_build_object('payaiPaymentId', $payment_id, 'reason', 'webhook_lost'));
UPDATE purchases SET status = 'SETTLED', settled_at = now(), payai_payment_id = $payment_id
WHERE id = $purchase_id;
```

Always log a `payment_provider_events` row when manually reconciling so the
audit trail stays complete.
