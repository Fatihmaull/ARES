import { apiError, apiSuccess } from "@/lib/api";
import { refundDebit } from "@/lib/billing/ledger";
import { createRun } from "@/lib/billing/runs";
import { getPool } from "@/lib/db/pool";
import { getQueueClient } from "@/lib/queue/client";

export interface EnqueueReportInput {
  runId: string;
  requestId: string;
  wallet: string | null;
  parentRunId: string;
  provisionalDebitId?: number;
}

export async function enqueueReportResponse(input: EnqueueReportInput): Promise<Response> {
  const pool = getPool();
  if (pool) {
    await createRun({
      pool,
      id: input.runId,
      wallet: input.wallet,
      kind: "report",
      target: input.parentRunId,
      model: null,
      requestId: input.requestId,
      relatedDebitId: input.provisionalDebitId ?? null,
      meta: { source: "api/reports", parentRunId: input.parentRunId },
    });
  }

  try {
    const queue = await getQueueClient();
    const result = await queue.enqueue(
      {
        kind: "report-synth",
        runId: input.runId,
        requestId: input.requestId,
        wallet: input.wallet,
        parentRunId: input.parentRunId,
        provisionalDebitId: input.provisionalDebitId,
      },
      { jobId: input.runId },
    );
    return apiSuccess(input.requestId, {
      status: "queued",
      runId: input.runId,
      jobId: result.jobId,
      inline: result.inline,
      parentRunId: input.parentRunId,
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
      "Failed to enqueue report job.",
      500,
      msg,
    );
  }
}
