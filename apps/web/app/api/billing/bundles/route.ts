import { apiSuccess, getRequestId } from "@/lib/api";
import { TOPUP_BUNDLES } from "@/lib/billing/pricing";

export async function GET(req: Request) {
  const requestId = getRequestId(req);
  return apiSuccess(requestId, { bundles: [...TOPUP_BUNDLES] });
}
