import { Redis } from "@upstash/redis";

export interface NonceStore {
  reserve(nonce: string, ttlSec: number): Promise<void>;
  consume(nonce: string): Promise<boolean>;
}

class MemoryNonceStore implements NonceStore {
  private readonly entries = new Map<string, number>();

  async reserve(nonce: string, ttlSec: number): Promise<void> {
    const exp = Date.now() + ttlSec * 1000;
    this.entries.set(nonce, exp);
    this.sweep();
  }

  async consume(nonce: string): Promise<boolean> {
    const exp = this.entries.get(nonce);
    if (!exp || Date.now() > exp) {
      this.entries.delete(nonce);
      return false;
    }
    this.entries.delete(nonce);
    return true;
  }

  private sweep(): void {
    const now = Date.now();
    for (const [k, v] of this.entries) {
      if (v < now) this.entries.delete(k);
    }
  }
}

class RedisNonceStore implements NonceStore {
  constructor(private readonly redis: Redis) {}

  async reserve(nonce: string, ttlSec: number): Promise<void> {
    await this.redis.set(`siws:nonce:${nonce}`, "1", { ex: ttlSec });
  }

  async consume(nonce: string): Promise<boolean> {
    const key = `siws:nonce:${nonce}`;
    const v = await this.redis.get(key);
    if (v == null) return false;
    await this.redis.del(key);
    return true;
  }
}

let memorySingleton: MemoryNonceStore | null = null;

export function createNonceStore(): NonceStore {
  const url = process.env.UPSTASH_REDIS_REST_URL?.trim();
  const token = process.env.UPSTASH_REDIS_REST_TOKEN?.trim();
  if (url && token) {
    return new RedisNonceStore(new Redis({ url, token }));
  }
  if (!memorySingleton) memorySingleton = new MemoryNonceStore();
  return memorySingleton;
}
