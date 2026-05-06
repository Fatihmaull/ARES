export function isAdminWallet(wallet: string): boolean {
  const raw = process.env.ASST_ADMIN_WALLETS?.trim();
  if (!raw) return false;
  const set = new Set(
    raw
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean),
  );
  return set.has(wallet);
}
