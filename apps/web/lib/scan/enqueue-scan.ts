import { apiError, apiSuccess } from "@/lib/api";
import { refundDebit } from "@/lib/billing/ledger";
import { createRun } from "@/lib/billing/runs";
import { getPool } from "@/lib/db/pool";
import { getQueueClient } from "@/lib/queue/client";

export interface EnqueueScanInput {
  runId: string;
  requestId: string;
  target: string;
  model?: string;
  wallet: string | null;
  provisionalDebitId?: number;
  meta?: Record<string, unknown>;
}

export async function enqueueScanResponse(input: EnqueueScanInput): Promise<Response> {
  const pool = getPool();
  if (pool) {
    await createRun({
      pool,
      id: input.runId,
      wallet: input.wallet,
      kind: "scan",
      target: input.target,
      model: input.model ?? null,
      requestId: input.requestId,
      relatedDebitId: input.provisionalDebitId ?? null,
      meta: { source: "api/scan", ...(input.meta ?? {}) },
    });
  }

  try {
    const queue = await getQueueClient();
    const result = await queue.enqueue(
      {
        kind: "scan-full",
        runId: input.runId,
        requestId: input.requestId,
        wallet: input.wallet,
        target: input.target,
        model: input.model,
        provisionalDebitId: input.provisionalDebitId,
      },
      { jobId: input.runId },
    );
    return apiSuccess(input.requestId, {
      status: "queued",
      runId: input.runId,
      jobId: result.jobId,
      inline: result.inline,
      target: input.target,
      timestamp: new Date().toISOString(),
    });
  } catch (error: unknown) {
    if (pool && input.provisionalDebitId !== undefined) {
      await refundDebit(pool, input.provisionalDebitId).catch(() => {});
    }
    const msg = error instanceof Error ? error.message : String(error);
    return apiError(
      input.requestId,
      "INTERNAL_ERROR",
      "Failed to enqueue scan job.",
      500,
      msg,
    );
  }
}
