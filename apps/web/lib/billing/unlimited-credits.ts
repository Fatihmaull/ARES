import { isAdminWallet } from "@/lib/admin";

/**
 * Wallets that skip credit checks and ledger debits for chat / scan / report synthesis.
 * Comma-separated base58 addresses in ASST_UNLIMITED_CREDIT_WALLETS.
 * ASST_ADMIN_WALLETS entries also qualify (operators-style bypass without operator header).
 */
export function hasUnlimitedCredits(wallet: string): boolean {
  if (!wallet?.trim()) return false;
  if (isAdminWallet(wallet)) return true;

  const raw = process.env.ASST_UNLIMITED_CREDIT_WALLETS?.trim();
  if (!raw) return false;

  const set = new Set(
    raw
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean),
  );
  return set.has(wallet);
}
