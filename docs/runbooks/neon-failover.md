# Runbook: Neon failover / DB outage

## Detection

- Vercel function errors: `ECONNREFUSED`, `relation "..." does not exist`.
- Worker errors logged with `pg` connection failures.
- `/api/health` returns 503 from `apps/web`.

## Mitigation

1. **Status check:** [Neon status](https://status.neon.tech) and the project
   console (compute branch state).

2. **Read-only mode:** if Neon is in failover, set:
   ```
   ASST_FEATURE_PAY_ENABLED=false
   ASST_FEATURE_SCAN_ENQUEUE_ENABLED=false
   ```
   on Vercel and redeploy. The web UI shows a banner "Top-ups paused" and
   the scan API rejects new requests with 503.

3. **Worker:** Fly worker keeps draining its in-flight queue. New `running`
   runs will fail and refund automatically when the DB returns.

4. **Restore:** when Neon recovers, flip the feature flags back. Run the
   `Database Migrations` workflow to reapply any new migrations safely
   (idempotent `IF NOT EXISTS`).

## Connection pool tuning

- `apps/web`: pool `max=10` per Lambda. Vercel scales horizontally; ensure
  Neon project's autoscale connection pool is enabled.
- `apps/worker`: pool `max=10` total. Fly machines never exceed 3 by default,
  so 30 connections is the production ceiling.
- `apps/chain-intake`: pool `max=10`.

## Backups

- Neon Point-in-Time Restore is enabled per project.
- Daily logical dumps of `purchases`, `credits_ledger`, `payment_provider_events`
  are exported to R2 by the `pg-export` cron (TODO if not configured).
