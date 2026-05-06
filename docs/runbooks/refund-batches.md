# Runbook: Refund batches

## When

- A skill / model / tool produces a systemic incorrect output and we want to
  refund all affected runs in a window.
- A wrong cost-class catalog row charged users too much; we want to credit
  back the delta.

## Procedure

1. **Identify** affected runs:
   ```sql
   SELECT id, wallet, units_billed, related_debit_id
     FROM runs
    WHERE created_at BETWEEN $start AND $end
      AND meta->>'model' = $model
      AND status = 'succeeded';
   ```

2. **Snapshot** to a temp table for audit:
   ```sql
   CREATE TABLE refund_batches_$batch_id AS
   SELECT id AS run_id, wallet, units_billed, related_debit_id
     FROM runs
    WHERE id = ANY($run_ids);
   ```

3. **Credit** each affected wallet:
   ```sql
   INSERT INTO credits_ledger (wallet, direction, units, reason, status, related_run_id, meta)
   SELECT wallet, 'CREDIT', units_billed, 'refund_batch', 'SETTLED', run_id,
          jsonb_build_object('batchId', $batch_id, 'reason', $reason)
     FROM refund_batches_$batch_id;
   ```

4. **Notify** affected wallets (out of band — email/X/dashboard banner).

## Caveats

- Always insert `CREDIT SETTLED` rows for refunds. Never `UPDATE` an existing
  `DEBIT` row — the ledger is append-only by spec.
- The `meta.batchId` lets future audits trace exactly what we credited.
