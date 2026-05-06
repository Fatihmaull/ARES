import type pg from "pg";

export type ReportKind = "pdf" | "sarif" | "json";

export interface ReportRow {
  id: string;
  run_id: string | null;
  wallet: string | null;
  kind: ReportKind;
  title: string;
  summary: string | null;
  meta: Record<string, unknown>;
  created_at: Date;
}

export interface ReportArtifactRow {
  id: string;
  report_id: string;
  object_key: string;
  bucket: string;
  bytes: string;
  content_type: string;
  created_at: Date;
}

export async function listReports(input: {
  pool: pg.Pool;
  wallet: string | null;
  limit: number;
}): Promise<ReportRow[]> {
  if (input.wallet) {
    const r = await input.pool.query<ReportRow>(
      `SELECT id, run_id, wallet, kind, title, summary, meta, created_at
         FROM reports
        WHERE wallet = $1
        ORDER BY created_at DESC
        LIMIT $2`,
      [input.wallet, input.limit],
    );
    return r.rows;
  }
  const r = await input.pool.query<ReportRow>(
    `SELECT id, run_id, wallet, kind, title, summary, meta, created_at
       FROM reports ORDER BY created_at DESC LIMIT $1`,
    [input.limit],
  );
  return r.rows;
}

export async function getReportArtifact(
  pool: pg.Pool,
  reportId: string,
): Promise<ReportArtifactRow | null> {
  const r = await pool.query<ReportArtifactRow>(
    `SELECT id::text, report_id, object_key, bucket, bytes::text, content_type, created_at
       FROM report_artifacts WHERE report_id = $1
       ORDER BY id DESC LIMIT 1`,
    [reportId],
  );
  return r.rows[0] ?? null;
}

export interface FindingRow {
  id: string;
  run_id: string;
  agent: string;
  layer: "orchestrator" | "supervisor" | "coordinator" | "sub_agent" | "worker";
  severity: "critical" | "high" | "medium" | "low" | "informational";
  title: string;
  detail: Record<string, unknown>;
  created_at: Date;
}

export async function listFindings(input: {
  pool: pg.Pool;
  wallet: string | null;
  limit: number;
}): Promise<FindingRow[]> {
  if (input.wallet) {
    const r = await input.pool.query<FindingRow>(
      `SELECT f.id::text, f.run_id, f.agent, f.layer, f.severity, f.title, f.detail, f.created_at
         FROM findings f
         JOIN runs r ON r.id = f.run_id
        WHERE r.wallet = $1
        ORDER BY f.created_at DESC
        LIMIT $2`,
      [input.wallet, input.limit],
    );
    return r.rows;
  }
  const r = await input.pool.query<FindingRow>(
    `SELECT id::text, run_id, agent, layer, severity, title, detail, created_at
       FROM findings ORDER BY created_at DESC LIMIT $1`,
    [input.limit],
  );
  return r.rows;
}
