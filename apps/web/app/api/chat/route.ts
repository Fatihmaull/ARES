import { createPublicOrchestrator } from "@/lib/engine-factory";
import { apiError, apiSuccess, enforceRateLimit, requireApiKey } from "@/lib/api";

export async function POST(req: Request) {
  const auth = requireApiKey(req);
  if (!auth.ok) return auth.response;
  const { requestId } = auth;
  const rate = enforceRateLimit(req, requestId, "chat", 30);
  if (!rate.ok) return rate.response;

  try {
    const body = await req.json();
    const { prompt, model } = body ?? {};

    if (!prompt || typeof prompt !== "string") {
      return apiError(requestId, "BAD_REQUEST", "Prompt is required.", 400);
    }

    const ares = createPublicOrchestrator({
      model,
    });
    const result = await ares.chat(prompt);

    return apiSuccess(requestId, { response: result });
  } catch (error: any) {
    console.error("API Route Error:", error);
    return apiError(
      requestId,
      "INTERNAL_ERROR",
      "Failed to communicate with ARES engine.",
      500,
      error.message || "Unknown execution error",
    );
  }
}
