import { buildSessionCookie } from "@/lib/auth/cookie";
import { createNonceStore } from "@/lib/auth/nonce-store";
import {
  extractExpirationFromSignedMessage,
  extractNonceFromSignedMessage,
} from "@/lib/auth/siws-message";
import { signSessionJwt } from "@/lib/auth/jwt";
import { verifyEd25519WalletSignature } from "@/lib/auth/verify-signature";
import { getBalanceUnits, upsertWalletFree } from "@/lib/billing/ledger";
import { getPool } from "@/lib/db/pool";
import { apiError, apiSuccess, getRequestId } from "@/lib/api";

export async function POST(req: Request) {
  const requestId = getRequestId(req);

  try {
    const body = await req.json();
    const address = typeof body?.address === "string" ? body.address.trim() : "";
    const signature = typeof body?.signature === "string" ? body.signature.trim() : "";
    const signedMessage =
      typeof body?.signedMessage === "string" ? body.signedMessage : "";

    if (!address || !signature || !signedMessage) {
      return apiError(requestId, "BAD_REQUEST", "address, signature, and signedMessage are required.", 400);
    }

    const exp = extractExpirationFromSignedMessage(signedMessage);
    if (!exp || exp.getTime() < Date.now()) {
      return apiError(requestId, "BAD_REQUEST", "Signed message expired.", 400);
    }

    const nonce = extractNonceFromSignedMessage(signedMessage);
    if (!nonce) {
      return apiError(requestId, "BAD_REQUEST", "Nonce missing from signed message.", 400);
    }

    const consumed = await createNonceStore().consume(nonce);
    if (!consumed) {
      return apiError(requestId, "BAD_REQUEST", "Invalid or reused nonce.", 400);
    }

    const sigOk = verifyEd25519WalletSignature({
      walletAddressBase58: address,
      messageUtf8: signedMessage,
      signatureBase58: signature,
    });
    if (!sigOk) {
      return apiError(requestId, "UNAUTHORIZED", "Signature verification failed.", 401);
    }

    const pool = getPool();
    if (!pool) {
      return apiError(
        requestId,
        "INTERNAL_ERROR",
        "DATABASE_URL is required for wallet sign-in.",
        503,
      );
    }

    await upsertWalletFree(pool, address);
    const balanceUnits = await getBalanceUnits(pool, address);
    const tier: "free" | "paid" = balanceUnits > 0 ? "paid" : "free";

    const ttlDays = Number.parseInt(process.env.ASST_SESSION_TTL_DAYS?.trim() || "30", 10);
    const token = await signSessionJwt({ sub: address, tier }, Number.isFinite(ttlDays) ? ttlDays : 30);
    if (!token) {
      return apiError(
        requestId,
        "INTERNAL_ERROR",
        "ASST_SESSION_SECRET is not configured.",
        500,
      );
    }

    const maxAgeSec = (Number.isFinite(ttlDays) ? ttlDays : 30) * 86400;
    const res = apiSuccess(requestId, {
      wallet: address,
      tier,
      balanceUnits,
    });
    res.headers.append("Set-Cookie", buildSessionCookie(token, maxAgeSec));
    return res;
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    return apiError(requestId, "INTERNAL_ERROR", "Verification failed.", 500, msg);
  }
}
