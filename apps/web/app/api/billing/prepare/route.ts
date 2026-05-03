import { apiError, apiSuccess, getRequestId } from "@/lib/api";
import { readWalletSession } from "@/lib/auth/read-session";
import { TOPUP_BUNDLES } from "@/lib/billing/pricing";

export async function POST(req: Request) {
  const requestId = getRequestId(req);
  const session = await readWalletSession(req);
  if (!session) {
    return apiError(requestId, "UNAUTHORIZED", "Wallet session required.", 401);
  }

  const treasury = process.env.ASST_TREASURY_WALLET?.trim();
  if (!treasury) {
    return apiError(requestId, "INTERNAL_ERROR", "ASST_TREASURY_WALLET is not configured.", 503);
  }

  let bundleId = "";
  try {
    const body = await req.json();
    bundleId = typeof body?.bundleId === "string" ? body.bundleId.trim() : "";
  } catch {
    return apiError(requestId, "BAD_REQUEST", "JSON body required.", 400);
  }

  const bundle = TOPUP_BUNDLES.find((b) => b.id === bundleId);
  if (!bundle) {
    return apiError(requestId, "BAD_REQUEST", "Unknown bundle.", 400);
  }

  const clientNonce = crypto.randomUUID();
  const memo = `ASST:${session.sub}:${bundle.id}:${clientNonce}`;

  return apiSuccess(requestId, {
    treasury,
    memo,
    bundleId: bundle.id,
    units: bundle.units,
    usdc: bundle.usdc,
    label: bundle.label,
    clientNonce,
    mintUsdc: process.env.ASST_DEPOSIT_MINT_USDC?.trim() || null,
  });
}
