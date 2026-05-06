/**
 * Run persistence for chat/scan/tool/report jobs. Replaces the legacy
 * filesystem `assurance/` view in P6 — `apps/web` reads from this table,
 * `apps/worker` writes to it.
 */
import type pg from "pg";

export type RunKind = "chat" | "scan" | "tool" | "report";
export type RunStatus = "queued" | "running" | "succeeded" | "failed" | "canceled";

export interface RunRow {
  id: string;
  wallet: string | null;
  kind: RunKind;
  status: RunStatus;
  target: string | null;
  model: string | null;
  request_id: string | null;
  related_debit_id: string | null;
  units_billed: string | null;
  trace: unknown;
  meta: Record<string, unknown>;
  created_at: Date;
  started_at: Date | null;
  finished_at: Date | null;
  error: string | null;
}

export async function createRun(input: {
  pool: pg.Pool;
  id: string;
  wallet: string | null;
  kind: RunKind;
  target?: string | null;
  model?: string | null;
  requestId?: string | null;
  relatedDebitId?: number | null;
  meta?: Record<string, unknown>;
}): Promise<void> {
  await input.pool.query(
    `INSERT INTO runs (id, wallet, kind, status, target, model, request_id, related_debit_id, meta)
     VALUES ($1, $2, $3, 'queued', $4, $5, $6, $7, $8::jsonb)
     ON CONFLICT (id) DO NOTHING`,
    [
      input.id,
      input.wallet,
      input.kind,
      input.target ?? null,
      input.model ?? null,
      input.requestId ?? null,
      input.relatedDebitId ?? null,
      JSON.stringify(input.meta ?? {}),
    ],
  );
}

export async function setRunStatus(input: {
  pool: pg.Pool;
  id: string;
  status: RunStatus;
  error?: string | null;
  unitsBilled?: number | null;
}): Promise<void> {
  const fields: string[] = ["status = $2"];
  const values: unknown[] = [input.id, input.status];
  let idx = 3;

  if (input.status === "running") {
    fields.push("started_at = COALESCE(started_at, now())");
  }
  if (input.status === "succeeded" || input.status === "failed" || input.status === "canceled") {
    fields.push("finished_at = now()");
  }
  if (input.error !== undefined) {
    fields.push(`error = $${idx++}`);
    values.push(input.error);
  }
  if (input.unitsBilled !== undefined && input.unitsBilled !== null) {
    fields.push(`units_billed = $${idx++}`);
    values.push(input.unitsBilled);
  }

  await input.pool.query(
    `UPDATE runs SET ${fields.join(", ")} WHERE id = $1`,
    values,
  );
}

export async function appendTraceEvent(input: {
  pool: pg.Pool;
  runId: string;
  event: Record<string, unknown>;
}): Promise<void> {
  await input.pool.query(
    `UPDATE runs
        SET trace = COALESCE(trace, '[]'::jsonb) || $2::jsonb
      WHERE id = $1`,
    [input.runId, JSON.stringify([input.event])],
  );
}

export async function getRun(pool: pg.Pool, id: string): Promise<RunRow | null> {
  const r = await pool.query<RunRow>(
    `SELECT id, wallet, kind, status, target, model, request_id,
            related_debit_id::text AS related_debit_id,
            units_billed::text AS units_billed,
            trace, meta, created_at, started_at, finished_at, error
       FROM runs WHERE id = $1`,
    [id],
  );
  return r.rows[0] ?? null;
}

export async function listRecentRuns(input: {
  pool: pg.Pool;
  wallet: string | null;
  limit: number;
}): Promise<RunRow[]> {
  if (input.wallet) {
    const r = await input.pool.query<RunRow>(
      `SELECT id, wallet, kind, status, target, model, request_id,
              related_debit_id::text AS related_debit_id,
              units_billed::text AS units_billed,
              trace, meta, created_at, started_at, finished_at, error
         FROM runs
        WHERE wallet = $1
        ORDER BY created_at DESC
        LIMIT $2`,
      [input.wallet, input.limit],
    );
    return r.rows;
  }
  const r = await input.pool.query<RunRow>(
    `SELECT id, wallet, kind, status, target, model, request_id,
            related_debit_id::text AS related_debit_id,
            units_billed::text AS units_billed,
            trace, meta, created_at, started_at, finished_at, error
       FROM runs
      ORDER BY created_at DESC
      LIMIT $1`,
    [input.limit],
  );
  return r.rows;
}
