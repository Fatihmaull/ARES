# Runbook: Worker drain / restart

## Graceful drain (recommended)

```bash
flyctl apps restart ares-worker
```

Fly sends `SIGTERM`; the worker's shutdown handler:
1. Stops pulling new jobs from BullMQ.
2. Waits up to 30s for in-flight jobs to finish.
3. Closes the DB pool and exits.

Jobs in flight at shutdown are **retried** (BullMQ `attempts: 3`,
exponential backoff). The DB run row stays in `running` until the next
attempt picks it up; the trace log records the worker that crashed.

## Force restart

```bash
flyctl machine restart -a ares-worker <machine-id>
```

Use only when the worker is wedged. Surviving in-flight jobs go back to the
queue automatically.

## Scale up under load

```bash
flyctl scale count 3 -a ares-worker
flyctl scale memory 2048 -a ares-worker
```

`bullmq` workers coordinate via Redis, so multiple instances pull jobs
without coordination.

## Stuck `running` runs

```sql
UPDATE runs
   SET status = 'failed', error = 'worker crash', finished_at = now()
 WHERE status = 'running' AND started_at < now() - INTERVAL '30 minutes';
```

After this, the next scheduled cron (or `apps/web` `/api/admin/reconcile-payai`)
refunds any `PENDING` debits attached to those runs.
