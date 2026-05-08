import type pg from "pg";

export type FindingWorkflowStatus = "open" | "acknowledged" | "resolved" | "wont_fix";

export async function updateFindingStatus(input: {
  pool: pg.Pool;
  findingId: bigint | number | string;
  wallet: string | null;
  operator: boolean;
  status: FindingWorkflowStatus;
  notes?: string | null;
}): Promise<{ updated: boolean }> {
  const fid = BigInt(String(input.findingId));

  if (input.operator || !input.wallet) {
    const r = await input.pool.query(
      `UPDATE findings
          SET status = $2::text,
              notes = COALESCE($3::text, notes),
              resolved_at = CASE WHEN $2::text IN ('resolved','wont_fix') THEN now() ELSE NULL END,
              resolved_by_wallet = CASE WHEN $2::text IN ('resolved','wont_fix') THEN resolved_by_wallet ELSE NULL END
        WHERE id = $1::bigint
        RETURNING id`,
      [fid.toString(), input.status, input.notes ?? null],
    );
    return { updated: (r.rowCount ?? 0) > 0 };
  }

  const r = await input.pool.query(
    `UPDATE findings f
        SET status = $2::text,
            notes = COALESCE($3::text, f.notes),
            resolved_at = CASE WHEN $2::text IN ('resolved','wont_fix') THEN now() ELSE NULL END,
            resolved_by_wallet = CASE WHEN $2::text IN ('resolved','wont_fix') THEN $4::text ELSE NULL END
       FROM runs r
      WHERE f.id = $1::bigint
        AND f.run_id = r.id
        AND r.wallet = $4::text
      RETURNING f.id`,
    [fid.toString(), input.status, input.notes ?? null, input.wallet],
  );
  return { updated: (r.rowCount ?? 0) > 0 };
}
