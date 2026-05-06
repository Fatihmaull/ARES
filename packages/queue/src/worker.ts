import {
  DEFAULT_QUEUE_NAME,
  type AnyJobPayload,
  type JobHandler,
} from "./types.js";
import { getQueueRedisUrl, isQueueRedisConfigured, setInlineHandler } from "./client.js";

export interface StartWorkerOptions {
  queueName?: string;
  concurrency?: number;
  handler: JobHandler;
  /** Called when the worker is shutting down (SIGTERM/SIGINT). */
  onClose?: () => Promise<void> | void;
}

export interface WorkerHandle {
  close(): Promise<void>;
}

/**
 * Start a BullMQ worker against Redis when configured. In dev (no Redis), we
 * register the handler as the in-process inline handler so apps/web's queue
 * client can still dispatch jobs without a worker process.
 */
export async function startWorker(opts: StartWorkerOptions): Promise<WorkerHandle> {
  const concurrency = opts.concurrency ?? 4;
  const queueName = opts.queueName ?? DEFAULT_QUEUE_NAME;

  if (!isQueueRedisConfigured()) {
    setInlineHandler(opts.handler);
    return {
      close: async () => {
        setInlineHandler(null);
        if (opts.onClose) await opts.onClose();
      },
    };
  }

  const { Worker } = await import("bullmq");
  const worker = new Worker(
    queueName,
    async (job) => {
      const payload = job.data as AnyJobPayload;
      await opts.handler(payload, {
        jobId: job.id,
        attempt: job.attemptsMade,
        attempts: job.opts.attempts,
      });
    },
    {
      connection: {
        url: getQueueRedisUrl(),
        maxRetriesPerRequest: null,
        enableReadyCheck: false,
      } as unknown as Record<string, unknown>,
      concurrency,
    },
  );

  worker.on("error", (err) => {
    console.error("[ares-queue/worker] error:", err);
  });

  worker.on("failed", (job, err) => {
    console.error(
      `[ares-queue/worker] job ${job?.id} (${job?.name}) failed:`,
      err?.message ?? err,
    );
  });

  return {
    close: async () => {
      await worker.close();
      if (opts.onClose) await opts.onClose();
    },
  };
}
