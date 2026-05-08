import type pg from "pg";

export async function notifyWallet(input: {
  pool: pg.Pool;
  wallet: string | null | undefined;
  kind: string;
  title: string;
  body?: string | null;
  relatedRunId?: string | null;
}): Promise<void> {
  if (!input.wallet) return;
  await input.pool.query(
    `INSERT INTO notifications (wallet, kind, title, body, related_run_id)
     VALUES ($1, $2, $3, $4, $5)`,
    [
      input.wallet,
      input.kind,
      input.title,
      input.body ?? null,
      input.relatedRunId ?? null,
    ],
  );
}
