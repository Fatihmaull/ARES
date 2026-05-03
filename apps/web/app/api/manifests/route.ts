import { getAssuranceData } from "@/lib/data";
import { apiSuccess, requireApiKeyOrPublic } from "@/lib/api";

export async function GET(req: Request) {
  const auth = requireApiKeyOrPublic(req);
  if (!auth.ok) return auth.response;
  const { requestId } = auth;

  const data = getAssuranceData();
  return apiSuccess(requestId, data);
}
