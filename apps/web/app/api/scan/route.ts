import { createPublicOrchestrator } from "@/lib/engine-factory";
import { apiError, apiSuccess, enforceRateLimit, requireApiKey } from "@/lib/api";

export async function POST(req: Request) {
  const auth = requireApiKey(req);
  if (!auth.ok) return auth.response;
  const { requestId } = auth;
  const rate = enforceRateLimit(req, requestId, "scan", 10);
  if (!rate.ok) return rate.response;

  try {
    const body = await req.json();
    const { target, model } = body ?? {};

    const ares = createPublicOrchestrator({ model });

    // Scan runs in the background to avoid HTTP timeouts. In production this
    // should be behind a job queue (BullMQ / etc.).
    ares.runFullScan((agent, status) => {
      if (process.env.NODE_ENV !== "production") {
        console.log(`[scan] ${agent}: ${status}`);
      }
    }).catch((err) => {
      console.error("[ARES Scan Error]:", err);
    });

    return apiSuccess(requestId, {
      status: "queued",
      message: "Security scan initiated successfully.",
      target: typeof target === "string" ? target : ".",
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error("API Scan Route Error:", error);
    return apiError(
      requestId,
      "INTERNAL_ERROR",
      "Failed to initiate ARES scan.",
      500,
      error.message || "Unknown execution error",
    );
  }
}
