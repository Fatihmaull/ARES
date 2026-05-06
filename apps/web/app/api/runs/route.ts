import { apiError, apiSuccess, requireApiKeyOrPublic } from "@/lib/api";
import { readWalletSession } from "@/lib/auth/read-session";
import { getAssuranceData } from "@/lib/data";
import { listRecentRuns } from "@/lib/billing/runs";
import { getPool } from "@/lib/db/pool";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const auth = requireApiKeyOrPublic(req);
  if (!auth.ok) return auth.response;
  const { requestId } = auth;

  try {
    const url = new URL(req.url);
    const limitRaw = url.searchParams.get("limit");
    const limit = Math.min(100, Math.max(1, Number.parseInt(limitRaw || "40", 10) || 40));

    const pool = getPool();
    const session = pool ? await readWalletSession(req) : null;

    if (pool) {
      const rows = await listRecentRuns({ pool, wallet: session?.sub ?? null, limit });
      const runs = rows.map((r) => ({
        id: r.id,
        kind: r.kind,
        status: r.status,
        target: r.target,
        model: r.model,
        unitsBilled: r.units_billed ? Number.parseInt(r.units_billed, 10) : null,
        createdAt: r.created_at.toISOString(),
        startedAt: r.started_at?.toISOString() ?? null,
        finishedAt: r.finished_at?.toISOString() ?? null,
        error: r.error,
      }));
      return apiSuccess(requestId, {
        total: runs.length,
        runs,
        source: "db",
        generatedAt: new Date().toISOString(),
      });
    }

    // Fallback to legacy filesystem view when DATABASE_URL is unset (dev only).
    const { manifests } = getAssuranceData();
    const runs = manifests.map((m: any) => ({
      file: m.file,
      commit: m.git?.commit_sha?.substring(0, 7) || "unknown",
      branch: m.git?.branch || "unknown",
      timestamp: m.generated_at || null,
      semgrep: m.static_analysis?.semgrep?.status || "unknown",
      agentCount: m.agent_count || 0,
    }));
    return apiSuccess(requestId, {
      total: runs.length,
      runs,
      source: "filesystem",
      generatedAt: new Date().toISOString(),
    });
  } catch (error: any) {
    return apiError(requestId, "INTERNAL_ERROR", "Failed to list runs.", 500, error.message);
  }
}
