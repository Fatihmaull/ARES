import { getAssuranceData } from "@/lib/data";
import { apiSuccess, requireApiKey } from "@/lib/api";

export async function GET(req: Request) {
  const auth = requireApiKey(req);
  if (!auth.ok) return auth.response;
  const { requestId } = auth;

  const data = getAssuranceData();
  return apiSuccess(requestId, data);
}
