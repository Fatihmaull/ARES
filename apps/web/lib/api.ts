import { NextResponse } from "next/server";

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

const rateBuckets = new Map<string, { count: number; windowStart: number }>();

function getClientIp(req: Request): string {
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) {
    return forwarded.split(",")[0]?.trim() || "unknown";
  }
  return req.headers.get("x-real-ip") || "unknown";
}

function getRequestId(req: Request): string {
  return req.headers.get("x-request-id") || crypto.randomUUID();
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

export function enforceRateLimit(
  req: Request,
  requestId: string,
  keySuffix: string,
  maxPerMinute: number,
): { ok: true } | { ok: false; response: NextResponse<ApiErrorBody> } {
  const ip = getClientIp(req);
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
