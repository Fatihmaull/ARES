import { apiSuccess } from "@/lib/api";

export async function GET(req: Request) {
  const requestId = req.headers.get("x-request-id") || crypto.randomUUID();
  return apiSuccess(requestId, {
    status: "ok",
    service: "asst-web",
    timestamp: new Date().toISOString(),
  });
}
