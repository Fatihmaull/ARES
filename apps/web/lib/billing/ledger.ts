import type pg from "pg";

export async function upsertWalletFree(pool: pg.Pool, address: string): Promise<void> {
  await pool.query(
    `INSERT INTO wallets (address, tier) VALUES ($1, 'free')
     ON CONFLICT (address) DO NOTHING`,
    [address],
  );
}

export async function getBalanceUnits(pool: pg.Pool, wallet: string): Promise<number> {
  const r = await pool.query<{ bal: string }>(
    `SELECT COALESCE(SUM(CASE
          WHEN direction = 'CREDIT' AND status = 'SETTLED' THEN units
          WHEN direction = 'DEBIT' AND status = 'SETTLED' THEN -units
          ELSE 0 END), 0)::TEXT AS bal
       FROM credits_ledger WHERE wallet = $1`,
    [wallet],
  );
  const row = r.rows[0];
  return row?.bal ? Number.parseInt(row.bal, 10) : 0;
}

export async function insertDebitPending(params: {
  pool: pg.Pool;
  wallet: string;
  units: number;
  reason: string;
  relatedRunId?: string;
}): Promise<number> {
  const r = await params.pool.query<{ id: string }>(
    `INSERT INTO credits_ledger (wallet, direction, units, reason, status, related_run_id, meta)
     VALUES ($1, 'DEBIT', $2, $3, 'PENDING', $4, '{}'::jsonb)
     RETURNING id`,
    [params.wallet, params.units, params.reason, params.relatedRunId ?? null],
  );
  return Number.parseInt(r.rows[0]?.id ?? "0", 10);
}

export async function settleDebit(pool: pg.Pool, id: number): Promise<void> {
  await pool.query(
    `UPDATE credits_ledger SET status = 'SETTLED', settled_at = now() WHERE id = $1 AND status = 'PENDING'`,
    [id],
  );
}

export async function refundDebit(pool: pg.Pool, id: number): Promise<void> {
  await pool.query(
    `UPDATE credits_ledger SET status = 'REFUNDED', settled_at = now() WHERE id = $1 AND status = 'PENDING'`,
    [id],
  );
}

export async function ledgerHistory(
  pool: pg.Pool,
  wallet: string,
  limit: number,
): Promise<
  {
    id: string;
    direction: string;
    units: string;
    reason: string;
    status: string;
    created_at: Date;
    related_tx_sig: string | null;
    related_run_id: string | null;
  }[]
> {
  const r = await pool.query(
    `SELECT id, direction, units::TEXT, reason, status, created_at, related_tx_sig, related_run_id
     FROM credits_ledger WHERE wallet = $1 ORDER BY id DESC LIMIT $2`,
    [wallet, limit],
  );
  return r.rows as {
    id: string;
    direction: string;
    units: string;
    reason: string;
    status: string;
    created_at: Date;
    related_tx_sig: string | null;
    related_run_id: string | null;
  }[];
}
