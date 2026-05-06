import { apiSuccess, getRequestId } from "@/lib/api";
import { loadActiveCatalog, getFallbackCatalog } from "@/lib/billing/catalog";
import { TOPUP_BUNDLES } from "@/lib/billing/pricing";
import { getPool } from "@/lib/db/pool";
import { isPayAISkuEnabled, readPayAIConfig } from "@/lib/payments/payai";

export async function GET(req: Request) {
  const requestId = getRequestId(req);

  const pool = getPool();
  const catalog = pool ? await loadActiveCatalog(pool) : getFallbackCatalog();
  const payCfg = readPayAIConfig();

  const fromCatalog = catalog.skus.map((s) => ({
    id: s.id,
    label: s.label,
    usdc: s.amountUsdc,
    units: s.unitsCredited,
    tier: s.tier,
    tierFlipDurationDays: s.tierFlipDurationDays,
    rail: payCfg && isPayAISkuEnabled(payCfg, s.id) ? "payai" : "memo",
  }));
  const bundles = fromCatalog.length > 0
    ? fromCatalog
    : TOPUP_BUNDLES.map((b) => ({
        id: b.id,
        label: b.label,
        usdc: b.usdc,
        units: b.units,
        tier: "paid" as const,
        tierFlipDurationDays: null,
        rail: "memo" as const,
      }));

  return apiSuccess(requestId, {
    bundles,
    rails: {
      payai: Boolean(payCfg),
      memo: Boolean(process.env.ASST_TREASURY_WALLET?.trim()),
    },
  });
}
