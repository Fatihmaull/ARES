import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis/cloudflare";

/** REST-only Redis client — safe for Next.js middleware (Edge). */
export function createRedis(): Redis | null {
  const url = process.env.UPSTASH_REDIS_REST_URL?.trim();
  const token = process.env.UPSTASH_REDIS_REST_TOKEN?.trim();
  if (!url || !token) return null;
  return new Redis({ url, token });
}

let ipLimiter: Ratelimit | null | undefined;
let walletLimiter: Ratelimit | null | undefined;

/** 60 requests / minute per IP (draft §5). */
export function getIpMinuteLimiter(): Ratelimit | null {
  if (ipLimiter !== undefined) return ipLimiter;
  const redis = createRedis();
  if (!redis) {
    ipLimiter = null;
    return null;
  }
  ipLimiter = new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(60, "1 m"),
    prefix: "asst:rl:ip",
  });
  return ipLimiter;
}

/** 30 requests / minute per wallet (draft §5). */
export function getWalletMinuteLimiter(): Ratelimit | null {
  if (walletLimiter !== undefined) return walletLimiter;
  const redis = createRedis();
  if (!redis) {
    walletLimiter = null;
    return null;
  }
  walletLimiter = new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(30, "1 m"),
    prefix: "asst:rl:wallet",
  });
  return walletLimiter;
}

export function retryAfterSeconds(resetMs: number): number {
  const resetMsSafe = typeof resetMs === "number" ? resetMs : Date.now() + 60_000;
  return Math.max(1, Math.ceil(Math.max(0, resetMsSafe - Date.now()) / 1000));
}
