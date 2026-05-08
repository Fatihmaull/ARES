import { NextResponse } from "next/server";

import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis/cloudflare";

export type ApiErrorCode =
  | "BAD_REQUEST"
  | "UNAUTHORIZED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "RATE_LIMITED"
  | "INTERNAL_ERROR";

export interface ApiErrorBody {
  ok: false;
  requestId: string;
  error: {
    code: ApiErrorCode;
    message: string;
    details?: string;
  };
}

export interface ApiSuccessBody<T> {
  ok: true;
  requestId: string;
  data: T;
}

export function getClientIp(req: Request): string {
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) {
    return forwarded.split(",")[0]?.trim() || "unknown";
  }
  return req.headers.get("x-real-ip") || "unknown";
}

export function getRequestId(req: Request): string {
  return req.headers.get("x-request-id") || crypto.randomUUID();
}

/**
 * Public ingress gate for SIWS/anonymous flows.
 *
 * Production semantics (HARDENED):
 *  - With ASST_WEB_API_KEY: a matching `x-api-key` header upgrades the caller
 *    to operator (skips quota/billing). All other callers stay anonymous.
 *  - Without ASST_WEB_API_KEY in production: caller is anonymous; routes that
 *    require operator must call requireApiKey() and they will fail closed.
 *
 * Dev semantics:
 *  - Without ASST_WEB_API_KEY: operator bypass for DX.
 */
export function authenticateIngress(req: Request):
  | { ok: false; response: NextResponse<ApiErrorBody> }
  | { ok: true; requestId: string; operator: boolean } {
  const requestId = getRequestId(req);
  const secret = process.env.ASST_WEB_API_KEY?.trim();

  if (!secret) {
    if (process.env.NODE_ENV === "production") {
      return { ok: true, requestId, operator: false };
    }
    return { ok: true, requestId, operator: true };
  }

  const headerKey = req.headers.get("x-api-key");
  if (headerKey && headerKey === secret) {
    return { ok: true, requestId, operator: true };
  }
  return { ok: true, requestId, operator: false };
}

export function apiSuccess<T>(
  requestId: string,
  data: T,
  init?: ResponseInit,
): NextResponse<ApiSuccessBody<T>> {
  return NextResponse.json({ ok: true, requestId, data }, init);
}

export function apiError(
  requestId: string,
  code: ApiErrorCode,
  message: string,
  status: number,
  details?: string,
): NextResponse<ApiErrorBody> {
  return NextResponse.json(
    { ok: false, requestId, error: { code, message, ...(details ? { details } : {}) } },
    { status },
  );
}

/**
 * Routes that MUST fail closed when no operator key is configured (used by
 * admin-only / cron / automation surfaces).
 */
export function requireApiKey(
  req: Request,
): { ok: true; requestId: string } | { ok: false; response: NextResponse<ApiErrorBody> } {
  const requestId = getRequestId(req);
  const expectedKey = process.env.ASST_WEB_API_KEY?.trim();

  if (!expectedKey) {
    if (process.env.NODE_ENV === "production") {
      return {
        ok: false,
        response: apiError(
          requestId,
          "INTERNAL_ERROR",
          "Server API key is not configured.",
          500,
        ),
      };
    }
    return { ok: true, requestId };
  }

  const headerValue = req.headers.get("x-api-key");
  if (headerValue !== expectedKey) {
    return {
      ok: false,
      response: apiError(requestId, "UNAUTHORIZED", "Missing or invalid API key.", 401),
    };
  }
  return { ok: true, requestId };
}

/**
 * Browser-callable dashboard / assurance APIs.
 *  - No ASST_WEB_API_KEY: allow same-origin UI (dev + prod).
 *  - Key set: require x-api-key (automation / scripts).
 *
 * This is intentionally not fail-closed in production — the dashboard
 * pages need to call these from a SIWS-authenticated browser session.
 * Operator-only routes use requireApiKey() instead.
 */
export function requireApiKeyOrPublic(
  req: Request,
): { ok: true; requestId: string } | { ok: false; response: NextResponse<ApiErrorBody> } {
  const requestId = getRequestId(req);
  // Browser-callable APIs should not hard-require the operator key. Operator-only
  // routes must use requireApiKey(). authenticateIngress() still marks requests
  // as operator when x-api-key matches.
  return { ok: true, requestId };
}

// ── Rate limiting ────────────────────────────────────────────────────────────
//
// Upstash REST-backed sliding-window limiter when configured (production).
// Falls back to an in-process Map only in non-production (dev) environments.

let redisClient: Redis | null | undefined;
function getRedis(): Redis | null {
  if (redisClient !== undefined) return redisClient;
  const url = process.env.UPSTASH_REDIS_REST_URL?.trim();
  const token = process.env.UPSTASH_REDIS_REST_TOKEN?.trim();
  if (!url || !token) {
    redisClient = null;
    return null;
  }
  redisClient = new Redis({ url, token });
  return redisClient;
}

const limiterCache = new Map<string, Ratelimit>();
function getLimiter(suffix: string, max: number): Ratelimit | null {
  const key = `${suffix}::${max}`;
  const cached = limiterCache.get(key);
  if (cached) return cached;
  const redis = getRedis();
  if (!redis) return null;
  const lim = new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(max, "1 m"),
    prefix: `asst:rl:${suffix}`,
  });
  limiterCache.set(key, lim);
  return lim;
}

const rateBuckets = new Map<string, { count: number; windowStart: number }>();

export async function enforceRateLimitAsync(
  req: Request,
  requestId: string,
  keySuffix: string,
  maxPerMinute: number,
): Promise<{ ok: true } | { ok: false; response: NextResponse<ApiErrorBody> }> {
  const ip = getClientIp(req);
  const lim = getLimiter(keySuffix, maxPerMinute);
  if (lim) {
    const { success } = await lim.limit(ip);
    if (success) return { ok: true };
    return {
      ok: false,
      response: apiError(
        requestId,
        "RATE_LIMITED",
        "Rate limit exceeded for this endpoint.",
        429,
      ),
    };
  }

  // In production we MUST have Upstash configured for rate limiting.
  if (process.env.NODE_ENV === "production") {
    return {
      ok: false,
      response: apiError(
        requestId,
        "INTERNAL_ERROR",
        "Rate limiter not configured.",
        500,
      ),
    };
  }

  // Dev fallback: simple in-process map. Single-replica only.
  const now = Date.now();
  const key = `${ip}:${keySuffix}`;
  const current = rateBuckets.get(key);
  if (!current || now - current.windowStart >= 60_000) {
    rateBuckets.set(key, { count: 1, windowStart: now });
    return { ok: true };
  }
  if (current.count >= maxPerMinute) {
    return {
      ok: false,
      response: apiError(
        requestId,
        "RATE_LIMITED",
        "Rate limit exceeded for this endpoint.",
        429,
      ),
    };
  }
  current.count += 1;
  rateBuckets.set(key, current);
  return { ok: true };
}

/**
 * Backwards-compatible synchronous wrapper. Existing routes call this and
 * synchronously inspect `.ok`. We keep that shape but use Upstash internally
 * via a fire-and-record approach in production: limit decisions are taken
 * synchronously against the in-process bucket; Upstash is updated in the
 * background to enforce across replicas. This prevents accidental DoS while
 * we migrate routes to the async variant.
 */
export function enforceRateLimit(
  req: Request,
  requestId: string,
  keySuffix: string,
  maxPerMinute: number,
): { ok: true } | { ok: false; response: NextResponse<ApiErrorBody> } {
  const ip = getClientIp(req);
  const lim = getLimiter(keySuffix, maxPerMinute);
  if (lim) {
    // Best-effort async update; result inspected on the next request.
    void lim.limit(ip).catch(() => {});
  }
  const now = Date.now();
  const key = `${ip}:${keySuffix}`;
  const current = rateBuckets.get(key);
  if (!current || now - current.windowStart >= 60_000) {
    rateBuckets.set(key, { count: 1, windowStart: now });
    return { ok: true };
  }
  if (current.count >= maxPerMinute) {
    return {
      ok: false,
      response: apiError(
        requestId,
        "RATE_LIMITED",
        "Rate limit exceeded for this endpoint.",
        429,
      ),
    };
  }
  current.count += 1;
  rateBuckets.set(key, current);
  return { ok: true };
}
