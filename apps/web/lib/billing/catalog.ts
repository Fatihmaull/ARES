/**
 * Pricing catalog loader. Reads the latest non-retired row from `pricing_catalog`
 * (migration 007). Falls back to the static defaults so dev environments without
 * Postgres still function; in production the catalog must come from the DB.
 */
import type pg from "pg";

import { TOPUP_BUNDLES, ACTION_COST_UNITS } from "./pricing";

export type CostClass = "A" | "B" | "C" | "D";
export type Tier = "anon" | "free" | "paid" | "premium";

export interface CatalogSku {
  id: string;
  label: string;
  amountUsdc: number;
  unitsCredited: number;
  tier: "free" | "paid" | "premium";
  tierFlipDurationDays: number | null;
}

export interface CatalogToolClass {
  base: number;
  runtimeFactor: number;
}

export interface CatalogGuardrails {
  perRequestSpendCapUnits: number;
  perWalletDailySpendCapUnits: number;
  perToolCapUnits: number;
  concurrencyByTier: Record<Tier, number>;
}

export interface PricingCatalog {
  version: number;
  effectiveAt: Date;
  skus: CatalogSku[];
  operationMinUnits: { chat: number; scan: number; report: number; premiumTool: number };
  toolClasses: Record<CostClass, CatalogToolClass>;
  tierAllowedClasses: Record<Tier, CostClass[]>;
  guardrails: CatalogGuardrails;
}

const FALLBACK_CATALOG: PricingCatalog = {
  version: 0,
  effectiveAt: new Date(0),
  skus: TOPUP_BUNDLES.map((b) => ({
    id: b.id,
    label: b.label,
    amountUsdc: b.usdc,
    unitsCredited: b.units,
    tier: "paid",
    tierFlipDurationDays: null,
  })),
  operationMinUnits: {
    chat: ACTION_COST_UNITS.chat,
    scan: ACTION_COST_UNITS.scan,
    report: 2,
    premiumTool: 4,
  },
  toolClasses: {
    A: { base: 0, runtimeFactor: 0 },
    B: { base: 0, runtimeFactor: 1 },
    C: { base: 1, runtimeFactor: 2 },
    D: { base: 2, runtimeFactor: 4 },
  },
  tierAllowedClasses: {
    anon: ["A"],
    free: ["A", "B"],
    paid: ["A", "B", "C"],
    premium: ["A", "B", "C", "D"],
  },
  guardrails: {
    perRequestSpendCapUnits: 500,
    perWalletDailySpendCapUnits: 5000,
    perToolCapUnits: 200,
    concurrencyByTier: { anon: 1, free: 1, paid: 2, premium: 4 },
  },
};

let cached: { at: number; catalog: PricingCatalog } | undefined;
const CACHE_TTL_MS = 60_000;

export function getFallbackCatalog(): PricingCatalog {
  return FALLBACK_CATALOG;
}

export async function loadActiveCatalog(pool: pg.Pool | null): Promise<PricingCatalog> {
  if (!pool) return FALLBACK_CATALOG;
  if (cached && Date.now() - cached.at < CACHE_TTL_MS) return cached.catalog;

  const r = await pool.query<{ version: number; effective_at: Date; catalog: unknown }>(
    `SELECT version, effective_at, catalog FROM pricing_catalog
     WHERE retired_at IS NULL
     ORDER BY effective_at DESC, version DESC
     LIMIT 1`,
  );
  const row = r.rows[0];
  if (!row) {
    cached = { at: Date.now(), catalog: FALLBACK_CATALOG };
    return FALLBACK_CATALOG;
  }
  const parsed = parseCatalog(row.version, row.effective_at, row.catalog);
  cached = { at: Date.now(), catalog: parsed };
  return parsed;
}

export function resetCatalogCache(): void {
  cached = undefined;
}

function parseCatalog(version: number, effectiveAt: Date, raw: unknown): PricingCatalog {
  const obj = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const skus = Array.isArray(obj.skus) ? (obj.skus as CatalogSku[]) : FALLBACK_CATALOG.skus;
  const operationMinUnits = (obj.operationMinUnits as PricingCatalog["operationMinUnits"]) ??
    FALLBACK_CATALOG.operationMinUnits;
  const toolClasses = (obj.toolClasses as PricingCatalog["toolClasses"]) ??
    FALLBACK_CATALOG.toolClasses;
  const tierAllowedClasses = (obj.tierAllowedClasses as PricingCatalog["tierAllowedClasses"]) ??
    FALLBACK_CATALOG.tierAllowedClasses;
  const guardrails = (obj.guardrails as CatalogGuardrails) ?? FALLBACK_CATALOG.guardrails;

  return {
    version,
    effectiveAt,
    skus,
    operationMinUnits,
    toolClasses,
    tierAllowedClasses,
    guardrails,
  };
}
