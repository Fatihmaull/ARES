/**
 * Web-side queue client. Singleton-cached so each API route only opens one
 * BullMQ producer per process.
 */
import { createQueueClient as createSharedQueueClient, type QueueClient } from "@ares/queue";

let cached: QueueClient | null = null;
let inflight: Promise<QueueClient> | null = null;

export async function getQueueClient(): Promise<QueueClient> {
  if (cached) return cached;
  if (inflight) return inflight;
  inflight = createSharedQueueClient().then((q) => {
    cached = q;
    inflight = null;
    return q;
  });
  return inflight;
}

export async function closeQueueClient(): Promise<void> {
  if (cached) {
    await cached.close();
    cached = null;
  }
}
