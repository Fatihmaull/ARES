import type { Queue } from "bullmq";

import {
  DEFAULT_QUEUE_NAME,
  type AnyJobPayload,
  type EnqueueResult,
  type JobHandler,
  type QueueClient,
} from "./types.js";

let inlineHandler: JobHandler | null = null;

/**
 * Allow the same process to register an inline handler for dev environments
 * where Redis isn't available. apps/worker registers the production handler
 * via startWorker(); apps/web may register an inline handler in dev only.
 */
export function setInlineHandler(handler: JobHandler | null): void {
  inlineHandler = handler;
}

export function isQueueRedisConfigured(): boolean {
  return Boolean(process.env.ASST_QUEUE_REDIS_URL?.trim());
}

export function getQueueRedisUrl(): string {
  const v = process.env.ASST_QUEUE_REDIS_URL?.trim();
  if (!v) throw new Error("ASST_QUEUE_REDIS_URL is required");
  return v;
}

interface CreateOpts {
  queueName?: string;
}

export async function createQueueClient(opts: CreateOpts = {}): Promise<QueueClient> {
  const queueName = opts.queueName ?? DEFAULT_QUEUE_NAME;

  if (!isQueueRedisConfigured()) {
    if (process.env.NODE_ENV === "production") {
      throw new Error(
        "ASST_QUEUE_REDIS_URL is required in production. Refusing to start with inline-only queue.",
      );
    }
    return createInlineClient();
  }

  const { Queue: BullQueue } = await import("bullmq");
  const queue = new BullQueue(queueName, {
    connection: {
      url: getQueueRedisUrl(),
      maxRetriesPerRequest: null,
      enableReadyCheck: false,
    } as unknown as Record<string, unknown>,
    defaultJobOptions: {
      removeOnComplete: { age: 24 * 3600, count: 1000 },
      removeOnFail: { age: 7 * 24 * 3600 },
      attempts: 3,
      backoff: { type: "exponential", delay: 5000 },
    },
  });

  return {
    enqueue: async (payload, eopts) => enqueueOnQueue(queue, payload, eopts),
    close: async () => {
      await queue.close();
    },
  };
}

async function enqueueOnQueue<T extends AnyJobPayload>(
  queue: Queue,
  payload: T,
  opts?: { jobId?: string; delayMs?: number; attempts?: number },
): Promise<EnqueueResult> {
  const job = await queue.add(payload.kind, payload, {
    jobId: opts?.jobId,
    delay: opts?.delayMs,
    attempts: opts?.attempts,
  });
  return {
    jobId: job.id ?? payload.runId,
    queued: true,
    inline: false,
  };
}

function createInlineClient(): QueueClient {
  return {
    enqueue: async (payload) => {
      const handler = inlineHandler;
      if (!handler) {
        throw new Error(
          "Queue not configured: ASST_QUEUE_REDIS_URL is unset and no inline handler registered.",
        );
      }
      // Run on the next microtask so the API response can return first, mimicking async semantics.
      queueMicrotask(() => {
        handler(payload, { jobId: payload.runId, attempt: 1 }).catch((err) => {
          console.error("[ares-queue/inline] handler failed:", err);
        });
      });
      return { jobId: payload.runId, queued: true, inline: true };
    },
    close: async () => {
      // no-op for inline mode
    },
  };
}
