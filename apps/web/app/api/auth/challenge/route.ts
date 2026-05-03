import { NextResponse } from "next/server";

import { createNonceStore } from "@/lib/auth/nonce-store";
import { buildChallengeMessage } from "@/lib/auth/siws-message";
import { apiError, getRequestId } from "@/lib/api";

const TTL_SEC = 300;
const STATEMENT = "Sign in to ARES";

export async function POST(req: Request) {
  const requestId = getRequestId(req);

  try {
    const url = new URL(req.url);
    const forwardedHost = req.headers.get("x-forwarded-host");
    const host = forwardedHost?.split(",")[0]?.trim() || url.host;
    const domain =
      process.env.ASST_PUBLIC_HOST?.trim() ||
      host ||
      "localhost";

    const nonce = crypto.randomUUID();
    const issuedAt = new Date().toISOString();
    const expiresAt = new Date(Date.now() + TTL_SEC * 1000).toISOString();

    const message = buildChallengeMessage({
      nonce,
      domain,
      statement: STATEMENT,
      issuedAt,
      expiresAt,
    });

    await createNonceStore().reserve(nonce, TTL_SEC);

    return NextResponse.json({
      ok: true,
      requestId,
      data: {
        nonce,
        domain,
        statement: STATEMENT,
        issuedAt,
        expiresAt,
        message,
      },
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    return apiError(requestId, "INTERNAL_ERROR", "Failed to issue challenge.", 500, msg);
  }
}
