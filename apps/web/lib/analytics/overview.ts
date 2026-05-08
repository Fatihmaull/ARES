import type pg from "pg";

export interface OverviewStats {
  findingsOpenBySeverity: {
    critical: number;
    high: number;
    medium: number;
    low: number;
    informational: number;
  };
  findingsOpenTotal: number;
  runsLast7d: number;
  creditsBurnedLast7d: number;
  lastSuccessfulScanAt: string | null;
}

export async function getOverviewStats(
  pool: pg.Pool,
  wallet: string | null,
): Promise<OverviewStats> {
  const wClause = wallet ? "AND r.wallet = $1" : "";
  const wClauseLedger = wallet ? "AND wallet = $1" : "";
  const wClauseRuns = wallet ? "AND wallet = $1" : "";
  const params = wallet ? [wallet] : [];

  const findingsRes = await pool.query<{
    critical: string;
    high: string;
    medium: string;
    low: string;
    informational: string;
    total: string;
  }>(
    `SELECT
        COUNT(*) FILTER (WHERE f.severity = 'critical')::text AS critical,
        COUNT(*) FILTER (WHERE f.severity = 'high')::text AS high,
        COUNT(*) FILTER (WHERE f.severity = 'medium')::text AS medium,
        COUNT(*) FILTER (WHERE f.severity = 'low')::text AS low,
        COUNT(*) FILTER (WHERE f.severity = 'informational')::text AS informational,
        COUNT(*)::text AS total
       FROM findings f
       JOIN runs r ON r.id = f.run_id
      WHERE f.status IN ('open', 'acknowledged')
        ${wClause}`,
    params,
  );
  const fr = findingsRes.rows[0]!;

  const runsRes = await pool.query<{ c: string }>(
    `SELECT COUNT(*)::text AS c FROM runs
      WHERE created_at >= now() - interval '7 days'
        AND kind = 'scan'
        ${wClauseRuns}`,
    params,
  );

  const ledgerRes = await pool.query<{ s: string }>(
    `SELECT COALESCE(SUM(units), 0)::text AS s
       FROM credits_ledger
      WHERE direction = 'DEBIT'
        AND status = 'SETTLED'
        AND created_at >= now() - interval '7 days'
        ${wClauseLedger}`,
    params,
  );

  const lastScanRes = await pool.query<{ t: Date | null }>(
    `SELECT MAX(finished_at) AS t
       FROM runs
      WHERE kind = 'scan'
        AND status = 'succeeded'
        ${wClauseRuns}`,
    params,
  );

  return {
    findingsOpenBySeverity: {
      critical: Number.parseInt(fr.critical, 10),
      high: Number.parseInt(fr.high, 10),
      medium: Number.parseInt(fr.medium, 10),
      low: Number.parseInt(fr.low, 10),
      informational: Number.parseInt(fr.informational, 10),
    },
    findingsOpenTotal: Number.parseInt(fr.total, 10),
    runsLast7d: Number.parseInt(runsRes.rows[0]?.c ?? "0", 10),
    creditsBurnedLast7d: Number.parseInt(ledgerRes.rows[0]?.s ?? "0", 10),
    lastSuccessfulScanAt: lastScanRes.rows[0]?.t?.toISOString() ?? null,
  };
}
