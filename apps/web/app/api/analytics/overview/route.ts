import { apiError, apiSuccess, requireApiKeyOrPublic } from "@/lib/api";
import { readWalletSession } from "@/lib/auth/read-session";
import { getOverviewStats } from "@/lib/analytics/overview";
import { getPool } from "@/lib/db/pool";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const auth = requireApiKeyOrPublic(req);
  if (!auth.ok) return auth.response;
  const { requestId } = auth;

  const pool = getPool();
  if (!pool) {
    return apiError(requestId, "INTERNAL_ERROR", "DATABASE_URL is not configured.", 503);
  }

  const session = await readWalletSession(req);
  const wallet = session?.sub ?? null;

  try {
    const stats = await getOverviewStats(pool, wallet);
    return apiSuccess(requestId, {
      walletScoped: Boolean(wallet),
      ...stats,
      generatedAt: new Date().toISOString(),
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return apiError(requestId, "INTERNAL_ERROR", "Failed to load analytics.", 500, msg);
  }
}
