import { clearSessionCookie } from "@/lib/auth/cookie";
import { apiSuccess, getRequestId } from "@/lib/api";

export async function POST(req: Request) {
  const requestId = getRequestId(req);
  const res = apiSuccess(requestId, { loggedOut: true });
  res.headers.append("Set-Cookie", clearSessionCookie());
  return res;
}
