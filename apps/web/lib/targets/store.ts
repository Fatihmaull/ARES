import type pg from "pg";

export type TargetKind =
  | "solana_program"
  | "evm_contract"
  | "github_repo"
  | "domain"
  | "wallet";

export interface TargetRow {
  id: string;
  wallet: string;
  kind: TargetKind;
  identifier: string;
  label: string | null;
  created_at: Date;
  last_scanned_at: Date | null;
  last_run_id: string | null;
  archived_at: Date | null;
}

const KINDS = new Set<string>([
  "solana_program",
  "evm_contract",
  "github_repo",
  "domain",
  "wallet",
]);

export function assertTargetKind(k: string): asserts k is TargetKind {
  if (!KINDS.has(k)) {
    throw new Error(`invalid_target_kind:${k}`);
  }
}

/** Loose validation — tighten over time. */
export function validateIdentifier(kind: TargetKind, identifier: string): string {
  const id = identifier.trim();
  if (!id || id.length > 2048) throw new Error("invalid_identifier_length");

  if (kind === "evm_contract") {
    if (!/^0x[a-fA-F0-9]{40}$/.test(id)) throw new Error("invalid_evm_address");
    return id.toLowerCase();
  }
  if (kind === "domain") {
    if (!/^[a-zA-Z0-9][a-zA-Z0-9.-]{1,253}$/.test(id)) throw new Error("invalid_domain");
    return id;
  }
  if (kind === "github_repo") {
    if (
      !/^https?:\/\/github\.com\/[\w.-]+\/[\w.-]+\/?$/i.test(id) &&
      !/^[\w.-]+\/[\w.-]+$/.test(id)
    ) {
      throw new Error("invalid_github_repo");
    }
    return id;
  }
  // Solana-style pubkeys: base58, typical length 32–44
  if (kind === "solana_program" || kind === "wallet") {
    if (!/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(id)) throw new Error("invalid_solana_pubkey");
    return id;
  }
  return id;
}

export function scanTargetFromRow(row: TargetRow): string {
  return `${row.kind}:${row.identifier}`;
}

export async function listTargets(input: {
  pool: pg.Pool;
  wallet: string;
  includeArchived?: boolean;
}): Promise<TargetRow[]> {
  if (input.includeArchived) {
    const r = await input.pool.query<TargetRow>(
      `SELECT id::text, wallet, kind, identifier, label, created_at, last_scanned_at,
              last_run_id, archived_at
         FROM targets
        WHERE wallet = $1
        ORDER BY archived_at NULLS FIRST, created_at DESC`,
      [input.wallet],
    );
    return r.rows;
  }
  const r = await input.pool.query<TargetRow>(
    `SELECT id::text, wallet, kind, identifier, label, created_at, last_scanned_at,
            last_run_id, archived_at
       FROM targets
      WHERE wallet = $1 AND archived_at IS NULL
      ORDER BY created_at DESC`,
    [input.wallet],
  );
  return r.rows;
}

export async function getTarget(input: {
  pool: pg.Pool;
  wallet: string;
  id: string;
}): Promise<TargetRow | null> {
  const r = await input.pool.query<TargetRow>(
    `SELECT id::text, wallet, kind, identifier, label, created_at, last_scanned_at,
            last_run_id, archived_at
       FROM targets
      WHERE id = $1::uuid AND wallet = $2`,
    [input.id, input.wallet],
  );
  return r.rows[0] ?? null;
}

export async function insertTarget(input: {
  pool: pg.Pool;
  wallet: string;
  kind: TargetKind;
  identifier: string;
  label?: string | null;
}): Promise<TargetRow> {
  const label = input.label?.trim() || null;
  const r = await input.pool.query<TargetRow>(
    `INSERT INTO targets (wallet, kind, identifier, label)
     VALUES ($1, $2, $3, $4)
     RETURNING id::text, wallet, kind, identifier, label, created_at, last_scanned_at,
               last_run_id, archived_at`,
    [input.wallet, input.kind, input.identifier, label],
  );
  return r.rows[0]!;
}

export async function updateTarget(input: {
  pool: pg.Pool;
  wallet: string;
  id: string;
  label?: string | null;
  archived?: boolean;
}): Promise<TargetRow | null> {
  const sets: string[] = [];
  const vals: unknown[] = [];
  let i = 1;
  if (input.label !== undefined) {
    sets.push(`label = $${i++}`);
    vals.push(input.label?.trim() || null);
  }
  if (input.archived === true) {
    sets.push(`archived_at = now()`);
  }
  if (input.archived === false) {
    sets.push(`archived_at = NULL`);
  }
  if (!sets.length) return getTarget(input);

  vals.push(input.id, input.wallet);
  const r = await input.pool.query<TargetRow>(
    `UPDATE targets SET ${sets.join(", ")}
      WHERE id = $${i}::uuid AND wallet = $${i + 1}
      RETURNING id::text, wallet, kind, identifier, label, created_at, last_scanned_at,
                last_run_id, archived_at`,
    vals,
  );
  return r.rows[0] ?? null;
}

export async function deleteTarget(input: {
  pool: pg.Pool;
  wallet: string;
  id: string;
}): Promise<boolean> {
  const r = await input.pool.query(
    `DELETE FROM targets WHERE id = $1::uuid AND wallet = $2`,
    [input.id, input.wallet],
  );
  return (r.rowCount ?? 0) > 0;
}

export async function touchTargetScan(input: {
  pool: pg.Pool;
  wallet: string;
  targetId: string;
  runId: string;
}): Promise<void> {
  await input.pool.query(
    `UPDATE targets
        SET last_scanned_at = now(),
            last_run_id = $3
      WHERE id = $1::uuid AND wallet = $2`,
    [input.targetId, input.wallet, input.runId],
  );
}
