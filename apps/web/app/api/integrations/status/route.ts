import { apiSuccess, requireApiKeyOrPublic } from "@/lib/api";

export const runtime = "nodejs";

function envPresent(key: string): boolean {
  return Boolean(process.env[key]?.trim());
}

export async function GET(req: Request) {
  const auth = requireApiKeyOrPublic(req);
  if (!auth.ok) return auth.response;
  const { requestId } = auth;

  return apiSuccess(requestId, {
    helius: envPresent("HELIUS_API_KEY"),
    objectStore:
      envPresent("ASST_OBJECT_STORE_ENDPOINT") &&
      envPresent("ASST_OBJECT_STORE_BUCKET") &&
      envPresent("ASST_OBJECT_STORE_ACCESS_KEY_ID") &&
      envPresent("ASST_OBJECT_STORE_SECRET_ACCESS_KEY"),
    payai: envPresent("PAYAI_API_KEY"),
    google: envPresent("GOOGLE_API_KEY"),
    openrouter: envPresent("OPENROUTER_API_KEY"),
    openai: envPresent("OPENAI_API_KEY"),
    database: envPresent("DATABASE_URL"),
    queueRedis: envPresent("ASST_QUEUE_REDIS_URL"),
  });
}
