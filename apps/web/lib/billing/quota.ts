import type pg from "pg";

import {
  ANON_CHAT_PER_DAY,
  WALLET_FREE_CHAT_PER_DAY,
  WALLET_FREE_SCANS_PER_MONTH,
} from "./pricing";

export type WindowKind =
  | "anon_chat_daily"
  | "wallet_chat_daily"
  | "wallet_scan_monthly";

function utcDayStart(d = new Date()): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

function utcMonthStart(d = new Date()): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1));
}

const anonMemory = new Map<string, { count: number; day: string }>();

function anonMemoryKey(ip: string, kind: WindowKind): string {
  const day = utcDayStart().toISOString().slice(0, 10);
  return `${kind}:${ip}:${day}`;
}

/** In-process fallback when DATABASE_URL is unset (developer convenience). */
export function tryConsumeAnonChatMemory(ip: string): boolean {
  const key = anonMemoryKey(ip, "anon_chat_daily");
  const day = utcDayStart().toISOString().slice(0, 10);
  const cur = anonMemory.get(key);
  if (!cur || cur.day !== day) {
    anonMemory.set(key, { count: 1, day });
    return true;
  }
  if (cur.count >= ANON_CHAT_PER_DAY) return false;
  cur.count += 1;
  return true;
}

export async function tryConsumeQuota(params: {
  pool: pg.Pool | null;
  wallet: string;
  ip: string;
  kind: WindowKind;
  limit: number;
}): Promise<boolean> {
  if (!params.pool) {
    if (params.kind === "anon_chat_daily") {
      return tryConsumeAnonChatMemory(params.ip);
    }
    return false;
  }

  const windowStart =
    params.kind === "wallet_scan_monthly" ? utcMonthStart() : utcDayStart();

  const client = await params.pool.connect();
  try {
    await client.query("BEGIN");

    const sel = await client.query<{ count: number }>(
      `SELECT count FROM quota_counters
       WHERE wallet = $1 AND ip = $2 AND window_kind = $3 AND window_start = $4
       FOR UPDATE`,
      [params.wallet, params.ip, params.kind, windowStart.toISOString()],
    );

    const current = sel.rows[0]?.count ?? 0;
    if (current >= params.limit) {
      await client.query("ROLLBACK");
      return false;
    }

    if (sel.rows.length === 0) {
      await client.query(
        `INSERT INTO quota_counters (wallet, ip, window_kind, window_start, count)
         VALUES ($1, $2, $3, $4, 1)`,
        [params.wallet, params.ip, params.kind, windowStart.toISOString()],
      );
    } else {
      await client.query(
        `UPDATE quota_counters SET count = count + 1
         WHERE wallet = $1 AND ip = $2 AND window_kind = $3 AND window_start = $4`,
        [params.wallet, params.ip, params.kind, windowStart.toISOString()],
      );
    }

    await client.query("COMMIT");
    return true;
  } catch {
    await client.query("ROLLBACK");
    return false;
  } finally {
    client.release();
  }
}

export async function consumeAnonChatQuota(pool: pg.Pool | null, ip: string): Promise<boolean> {
  return tryConsumeQuota({
    pool,
    wallet: "",
    ip,
    kind: "anon_chat_daily",
    limit: ANON_CHAT_PER_DAY,
  });
}

export async function consumeWalletFreeChat(pool: pg.Pool | null, wallet: string, ip: string) {
  return tryConsumeQuota({
    pool,
    wallet,
    ip,
    kind: "wallet_chat_daily",
    limit: WALLET_FREE_CHAT_PER_DAY,
  });
}

export async function consumeWalletFreeScan(pool: pg.Pool | null, wallet: string, ip: string) {
  return tryConsumeQuota({
    pool,
    wallet,
    ip,
    kind: "wallet_scan_monthly",
    limit: WALLET_FREE_SCANS_PER_MONTH,
  });
}
