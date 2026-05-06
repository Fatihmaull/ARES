import { getAssuranceData } from "@/lib/data";
import { apiError, apiSuccess, requireApiKeyOrPublic } from "@/lib/api";

export async function GET(req: Request) {
  const auth = requireApiKeyOrPublic(req);
  if (!auth.ok) return auth.response;
  const { requestId } = auth;

  try {
    const { posture, latest, manifests } = getAssuranceData();

    return apiSuccess(requestId, {
      overall: posture.overall,
      grade: posture.grade,
      layers: posture.layers,
      latestRun: latest
        ? {
            commit: latest?.git?.commit_sha?.substring(0, 7) || "unknown",
            timestamp: latest?.generated_at || null,
            semgrep: latest?.static_analysis?.semgrep?.status || "unknown",
          }
        : null,
      totalRuns: manifests.length,
      generatedAt: new Date().toISOString(),
    });
  } catch (error: any) {
    return apiError(requestId, "INTERNAL_ERROR", "Failed to compute posture.", 500, error.message);
  }
}
