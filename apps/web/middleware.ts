import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import { enforceIpRateLimit } from "@/lib/ratelimit/ip";

/**
 * Never run rate-limit logic for Next internals or static assets.
 * If middleware runs on `/_next/static/*`, CSS/JS chunks can return non-asset
 * responses and the app renders unstyled (classic Next.js middleware pitfall).
 */
function isStaticOrAsset(pathname: string): boolean {
  if (
    pathname.startsWith("/_next/static") ||
    pathname.startsWith("/_next/image") ||
    pathname.startsWith("/_next/data") ||
    pathname === "/favicon.ico" ||
    pathname === "/robots.txt" ||
    pathname === "/sitemap.xml"
  ) {
    return true;
  }
  return /\.(?:svg|png|jpg|jpeg|gif|webp|ico|css|js|map|woff2?|ttf|eot)$/i.test(
    pathname,
  );
}

export async function middleware(request: NextRequest): Promise<NextResponse> {
  try {
    const pathname = request.nextUrl.pathname;

    if (isStaticOrAsset(pathname)) {
      return NextResponse.next();
    }

    // IP limits apply to API routes only (browser navigation skips Redis work).
    if (!pathname.startsWith("/api")) {
      return NextResponse.next();
    }

    const ip =
      request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      request.headers.get("x-real-ip") ||
      "127.0.0.1";

    const outcome = await enforceIpRateLimit(ip);
    if (!outcome.ok) {
      const requestId = crypto.randomUUID();
      return NextResponse.json(
        {
          ok: false,
          requestId,
          error: {
            code: "RATE_LIMITED",
            message: "Too many requests.",
            details: `retry_after_seconds=${outcome.retrySec}`,
          },
        },
        {
          status: 429,
          headers: { "Retry-After": String(outcome.retrySec) },
        },
      );
    }

    return NextResponse.next();
  } catch {
    // Fail open: never block HTML/CSS/JS because Redis or Edge threw.
    return NextResponse.next();
  }
}

export const config = {
  matcher: [
    /*
     * Exclude Next internals so middleware never touches CSS/JS chunks
     * (github.com/vercel/next.js/issues/92435).
     */
    "/((?!_next/static|_next/image|_next/data|favicon.ico|robots.txt|sitemap.xml).*)",
  ],
};
