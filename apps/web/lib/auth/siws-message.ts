export type ChallengePayload = {
  nonce: string;
  domain: string;
  statement: string;
  issuedAt: string;
  expiresAt: string;
};

export function buildChallengeMessage(args: ChallengePayload): string {
  return [
    `${args.domain} wants you to sign in with your Solana account:`,
    "",
    `Statement: ${args.statement}`,
    "",
    `Nonce: ${args.nonce}`,
    "",
    `Issued At: ${args.issuedAt}`,
    `Expiration Time: ${args.expiresAt}`,
  ].join("\n");
}

export function extractNonceFromSignedMessage(message: string): string | null {
  const lines = message.split(/\r?\n/);
  for (const line of lines) {
    const m = /^Nonce:\s*(.+)$/i.exec(line.trim());
    if (m?.[1]) return m[1].trim();
  }
  return null;
}

export function extractExpirationFromSignedMessage(message: string): Date | null {
  const lines = message.split(/\r?\n/);
  for (const line of lines) {
    const m = /^Expiration Time:\s*(.+)$/i.exec(line.trim());
    if (m?.[1]) {
      const d = new Date(m[1].trim());
      return Number.isNaN(d.getTime()) ? null : d;
    }
  }
  return null;
}
