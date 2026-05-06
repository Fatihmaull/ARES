import { SignJWT, jwtVerify } from "jose";

import { getJwtSecretBytes } from "./session-secret";

export type SessionJwtClaims = {
  sub: string;
  tier: "free" | "paid";
};

export async function signSessionJwt(
  claims: SessionJwtClaims,
  ttlDays: number,
): Promise<string | null> {
  const secret = getJwtSecretBytes();
  if (!secret) return null;

  return new SignJWT({ tier: claims.tier })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(claims.sub)
    .setIssuedAt()
    .setExpirationTime(`${ttlDays}d`)
    .sign(secret);
}

export async function verifySessionJwt(token: string): Promise<SessionJwtClaims | null> {
  const secret = getJwtSecretBytes();
  if (!secret) return null;
  try {
    const { payload } = await jwtVerify(token, secret, { algorithms: ["HS256"] });
    const sub = typeof payload.sub === "string" ? payload.sub : "";
    const tierRaw = payload.tier;
    const tier = tierRaw === "paid" ? "paid" : "free";
    if (!sub) return null;
    return { sub, tier };
  } catch {
    return null;
  }
}
