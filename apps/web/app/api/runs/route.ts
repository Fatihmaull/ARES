import { getAssuranceData } from "@/lib/data";
import { apiError, apiSuccess, requireApiKey } from "@/lib/api";

export async function GET(req: Request) {
  const auth = requireApiKey(req);
  if (!auth.ok) return auth.response;
  const { requestId } = auth;

  try {
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
      generatedAt: new Date().toISOString(),
    });
  } catch (error: any) {
    return apiError(requestId, "INTERNAL_ERROR", "Failed to list runs.", 500, error.message);
  }
}
