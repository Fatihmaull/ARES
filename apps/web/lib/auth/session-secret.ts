export function getJwtSecretBytes(): Uint8Array | null {
  const raw = process.env.ASST_SESSION_SECRET?.trim();
  if (!raw) return null;
  if (/^[0-9a-fA-F]{64}$/.test(raw)) {
    return Uint8Array.from(Buffer.from(raw, "hex"));
  }
  return new TextEncoder().encode(raw);
}
