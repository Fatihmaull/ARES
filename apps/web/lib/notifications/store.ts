import type pg from "pg";

export interface NotificationRow {
  id: string;
  wallet: string;
  kind: string;
  title: string;
  body: string | null;
  related_run_id: string | null;
  related_purchase_id: string | null;
  related_finding_id: string | null;
  created_at: Date;
  read_at: Date | null;
}

export async function insertNotification(input: {
  pool: pg.Pool;
  wallet: string;
  kind: string;
  title: string;
  body?: string | null;
  relatedRunId?: string | null;
  relatedPurchaseId?: string | null;
  relatedFindingId?: number | null;
}): Promise<void> {
  await input.pool.query(
    `INSERT INTO notifications (wallet, kind, title, body, related_run_id, related_purchase_id, related_finding_id)
     VALUES ($1, $2, $3, $4, $5, $6, $7)`,
    [
      input.wallet,
      input.kind,
      input.title,
      input.body ?? null,
      input.relatedRunId ?? null,
      input.relatedPurchaseId ?? null,
      input.relatedFindingId ?? null,
    ],
  );
}

export async function listNotifications(input: {
  pool: pg.Pool;
  wallet: string;
  limit: number;
}): Promise<NotificationRow[]> {
  const r = await input.pool.query<NotificationRow>(
    `SELECT id::text, wallet, kind, title, body, related_run_id,
            related_purchase_id::text, related_finding_id::text,
            created_at, read_at
       FROM notifications
      WHERE wallet = $1
      ORDER BY created_at DESC
      LIMIT $2`,
    [input.wallet, input.limit],
  );
  return r.rows;
}

export async function countUnread(pool: pg.Pool, wallet: string): Promise<number> {
  const r = await pool.query<{ c: string }>(
    `SELECT COUNT(*)::text AS c FROM notifications WHERE wallet = $1 AND read_at IS NULL`,
    [wallet],
  );
  return Number.parseInt(r.rows[0]?.c ?? "0", 10);
}

export async function markAllRead(pool: pg.Pool, wallet: string): Promise<number> {
  const r = await pool.query(
    `UPDATE notifications SET read_at = now()
      WHERE wallet = $1 AND read_at IS NULL`,
    [wallet],
  );
  return r.rowCount ?? 0;
}
