import type pg from "pg";

import type { HeliusEnhancedTx } from "./ingest.js";
import { BUNDLE_UNITS } from "./bundle-units.js";

export type DepositCreditResult = { credited: number; skipped: number };

/**
 * Parses memo format: ASST:<userWallet>:<bundleId>:<clientNonce>
 */
export function parseAsstMemo(memo: string): {
  userWallet: string;
  bundleId: string;
  clientNonce: string;
} | null {
  const prefix = "ASST:";
  const trimmed = memo.trim();
  const idx = trimmed.indexOf(prefix);
  const slice = idx >= 0 ? trimmed.slice(idx) : trimmed;
  if (!slice.startsWith(prefix)) return null;
  const rest = slice.slice(prefix.length);
  const parts = rest.split(":");
  if (parts.length < 3) return null;
  const userWallet = parts[0];
  const bundleId = parts[1];
  const clientNonce = parts.slice(2).join(":");
  if (!userWallet || !bundleId || !clientNonce) return null;
  return { userWallet, bundleId, clientNonce };
}

function collectStrings(obj: unknown, out: Set<string>): void {
  if (typeof obj === "string") {
    out.add(obj);
    return;
  }
  if (Array.isArray(obj)) {
    for (const x of obj) collectStrings(x, out);
    return;
  }
  if (obj && typeof obj === "object") {
    for (const v of Object.values(obj)) collectStrings(v, out);
  }
}

export function findAsstMemoInTx(tx: unknown): string | null {
  const strings = new Set<string>();
  collectStrings(tx, strings);
  for (const s of strings) {
    const i = s.indexOf("ASST:");
    if (i >= 0) {
      const tail = s.slice(i).replace(/\s+/g, " ").trim();
      const token = tail.split(/[\s"',}\]]/)[0];
      if (token?.startsWith("ASST:")) return token;
    }
  }
  return null;
}

type NativeRow = {
  fromUserAccount?: string;
  toUserAccount?: string;
  amount?: number;
};

function nativeTransfers(tx: Record<string, unknown>): NativeRow[] {
  const nt = tx.nativeTransfers;
  return Array.isArray(nt) ? (nt as NativeRow[]) : [];
}

function tokenTransfers(tx: Record<string, unknown>): Record<string, unknown>[] {
  const tt = tx.tokenTransfers;
  return Array.isArray(tt) ? (tt as Record<string, unknown>[]) : [];
}

function lamportsFromNativeRow(row: NativeRow): bigint {
  const n = row.amount;
  if (typeof n !== "number" || !Number.isFinite(n)) return 0n;
  return BigInt(Math.floor(n));
}

function signatureFromTx(tx: Record<string, unknown>): string | null {
  const s = tx.signature;
  return typeof s === "string" && s.trim() ? s.trim() : null;
}

/**
 * Credits wallets when a transaction pays the treasury with a valid ASST memo
 * and `fromUserAccount` matches the memo wallet (splash-risk mitigation).
 */
export async function applyBillingDeposits(
  client: pg.PoolClient,
  txs: HeliusEnhancedTx[],
): Promise<DepositCreditResult> {
  const treasury = process.env.ASST_TREASURY_WALLET?.trim();
  const usdcMint = process.env.ASST_DEPOSIT_MINT_USDC?.trim();

  if (!treasury) {
    return { credited: 0, skipped: txs.length };
  }

  let credited = 0;
  let skipped = 0;

  for (const raw of txs) {
    const tx = raw as Record<string, unknown>;
    const memoRaw = findAsstMemoInTx(tx);
    const parsedMemo = memoRaw ? parseAsstMemo(memoRaw) : null;
    const sig = signatureFromTx(tx);

    if (!parsedMemo || !sig) {
      skipped += 1;
      continue;
    }

    const units = BUNDLE_UNITS[parsedMemo.bundleId];
    if (!units) {
      skipped += 1;
      continue;
    }

    let sourceOk = false;
    let txSigNote = sig;

    for (const row of nativeTransfers(tx)) {
      const from = typeof row.fromUserAccount === "string" ? row.fromUserAccount : "";
      const to = typeof row.toUserAccount === "string" ? row.toUserAccount : "";
      const lamports = lamportsFromNativeRow(row);
      if (to === treasury && from === parsedMemo.userWallet && lamports > 0n) {
        sourceOk = true;
        break;
      }
    }

    if (!sourceOk && usdcMint) {
      for (const row of tokenTransfers(tx)) {
        const mint = typeof row.mint === "string" ? row.mint : "";
        const from = typeof row.fromUserAccount === "string" ? row.fromUserAccount : "";
        const to = typeof row.toUserAccount === "string" ? row.toUserAccount : "";
        const rawAmt = row.tokenAmount;
        const amt =
          typeof rawAmt === "number" && Number.isFinite(rawAmt)
            ? rawAmt
            : typeof rawAmt === "object" &&
                rawAmt &&
                typeof (rawAmt as { uiAmount?: number }).uiAmount === "number"
              ? (rawAmt as { uiAmount: number }).uiAmount
              : 0;
        if (mint === usdcMint && to === treasury && from === parsedMemo.userWallet && amt > 0) {
          sourceOk = true;
          break;
        }
      }
    }

    if (!sourceOk) {
      skipped += 1;
      continue;
    }

    try {
      await client.query(
        `INSERT INTO wallets (address, tier)
         VALUES ($1, 'paid')
         ON CONFLICT (address) DO UPDATE SET tier = CASE WHEN wallets.tier = 'paid' THEN wallets.tier ELSE 'paid' END`,
        [parsedMemo.userWallet],
      );

      const ins = await client.query(
        `INSERT INTO credits_ledger
           (wallet, direction, units, reason, status, related_tx_sig, meta)
         VALUES ($1, 'CREDIT', $2, 'deposit', 'SETTLED', $3, $4::jsonb)
         ON CONFLICT (related_tx_sig) DO NOTHING
         RETURNING id`,
        [
          parsedMemo.userWallet,
          units,
          txSigNote,
          JSON.stringify({
            bundleId: parsedMemo.bundleId,
            clientNonce: parsedMemo.clientNonce,
          }),
        ],
      );

      if (ins.rowCount !== 1) {
        skipped += 1;
        continue;
      }

      credited += 1;
    } catch {
      skipped += 1;
    }
  }

  return { credited, skipped };
}
