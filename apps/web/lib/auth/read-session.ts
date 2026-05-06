import { SESSION_COOKIE } from "./cookie";
import { verifySessionJwt } from "./jwt";

export function readCookie(cookieHeader: string | null, name: string): string | undefined {
  if (!cookieHeader) return undefined;
  for (const part of cookieHeader.split(";")) {
    const idx = part.indexOf("=");
    if (idx === -1) continue;
    const k = part.slice(0, idx).trim();
    const v = part.slice(idx + 1).trim();
    if (k === name) return decodeURIComponent(v);
  }
  return undefined;
}

export async function readWalletSession(req: Request) {
  const raw = readCookie(req.headers.get("cookie"), SESSION_COOKIE);
  if (!raw) return null;
  return verifySessionJwt(raw);
}
