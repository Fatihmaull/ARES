/**
 * @ares/queue — shared queue contract used by apps/web (producer) and apps/worker
 * (consumer). BullMQ over Redis when ASST_QUEUE_REDIS_URL is set; otherwise an
 * in-process inline executor that runs the handler immediately (dev only).
 *
 * Production callers must always provide ASST_QUEUE_REDIS_URL — the inline
 * fallback explicitly throws when NODE_ENV === 'production' and the env is
 * unset, to prevent silently degrading to fire-and-forget behavior.
 */
export * from "./types.js";
export { createQueueClient, getQueueRedisUrl, isQueueRedisConfigured } from "./client.js";
export { startWorker } from "./worker.js";
