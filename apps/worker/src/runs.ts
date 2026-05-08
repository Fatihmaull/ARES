import type pg from "pg";

export type RunStatus = "queued" | "running" | "succeeded" | "failed" | "canceled";

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

  await input.pool.query(`UPDATE runs SET ${fields.join(", ")} WHERE id = $1`, values);
}

export async function appendTraceEvent(input: {
  pool: pg.Pool;
  runId: string;
  event: Record<string, unknown>;
}): Promise<void> {
  await input.pool.query(
    `UPDATE runs SET trace = COALESCE(trace, '[]'::jsonb) || $2::jsonb WHERE id = $1`,
    [input.runId, JSON.stringify([input.event])],
  );
}

export async function settleDebit(pool: pg.Pool, id: number): Promise<void> {
  await pool.query(
    `UPDATE credits_ledger SET status = 'SETTLED', settled_at = now()
      WHERE id = $1 AND status = 'PENDING'`,
    [id],
  );
}

export async function refundDebit(pool: pg.Pool, id: number): Promise<void> {
  await pool.query(
    `UPDATE credits_ledger SET status = 'REFUNDED', settled_at = now()
      WHERE id = $1 AND status = 'PENDING'`,
    [id],
  );
}

export async function recordFinding(input: {
  pool: pg.Pool;
  runId: string;
  agent: string;
  layer: "orchestrator" | "supervisor" | "coordinator" | "sub_agent" | "worker";
  severity: "critical" | "high" | "medium" | "low" | "informational";
  title: string;
  detail: Record<string, unknown>;
}): Promise<void> {
  await input.pool.query(
    `INSERT INTO findings (run_id, agent, layer, severity, title, detail)
     VALUES ($1, $2, $3, $4, $5, $6::jsonb)`,
    [
      input.runId,
      input.agent,
      input.layer,
      input.severity,
      input.title,
      JSON.stringify(input.detail),
    ],
  );
}

export async function listFindingsForRun(
  pool: pg.Pool,
  runId: string,
): Promise<Array<{ severity: string; title: string; detail: Record<string, unknown> }>> {
  const r = await pool.query<{
    severity: string;
    title: string;
    detail: Record<string, unknown>;
  }>(
    `SELECT severity::text, title, detail
       FROM findings
      WHERE run_id = $1
      ORDER BY id ASC`,
    [runId],
  );
  return r.rows;
}

export async function insertPdfReportRecord(input: {
  pool: pg.Pool;
  reportId: string;
  synthesisRunId: string;
  wallet: string | null;
  title: string;
  summary: string | null;
  objectKey: string;
  bucket: string;
  bytes: number;
}): Promise<void> {
  const client = await input.pool.connect();
  try {
    await client.query("BEGIN");
    await client.query(
      `INSERT INTO reports (id, run_id, wallet, kind, title, summary, meta)
       VALUES ($1, $2, $3, 'pdf', $4, $5, '{}'::jsonb)`,
      [
        input.reportId,
        input.synthesisRunId,
        input.wallet,
        input.title,
        input.summary,
      ],
    );
    await client.query(
      `INSERT INTO report_artifacts (report_id, object_key, bucket, bytes, content_type)
       VALUES ($1, $2, $3, $4, 'application/pdf')`,
      [input.reportId, input.objectKey, input.bucket, input.bytes],
    );
    await client.query("COMMIT");
  } catch (e) {
    await client.query("ROLLBACK").catch(() => {});
    throw e;
  } finally {
    client.release();
  }
}
