/**
 * Adapted from `evals/solana-vuln-rust/src/eval-agreement.ts` — classifies whether
 * model prose affirms presence of a vulnerability.
 */

const DENIES_VULNS_PRESENT =
  /does not contain any (?:security\s+)?vulnerabilit(?:y|ies)/i;

function scanForAffirmativeVulnerability(text: string): string {
  let s = text;
  s = s.replace(/\bno\s+vulnerabilit(y|ies)\b/gi, "");
  s = s.replace(/\bwithout\s+vulnerabilit(y|ies)\b/gi, "");
  s = s.replace(
    /\bdoes not contain any (?:security\s+)?vulnerabilit(?:y|ies)\b/gi,
    "",
  );
  return s;
}

export function textAgreesVulnerableReference(text: string): boolean {
  const raw = text.trim();
  if (DENIES_VULNS_PRESENT.test(raw)) return false;
  if (/^\s*Yes\b/im.test(raw)) return true;
  const scan = scanForAffirmativeVulnerability(raw);
  return /\bvulnerabilit(y|ies)\b/i.test(scan);
}

export function textAgreesSafeReference(text: string): boolean {
  const raw = text.trim();
  if (/^\s*Yes\b/im.test(raw)) return false;
  if (textAgreesVulnerableReference(raw)) return false;
  if (DENIES_VULNS_PRESENT.test(raw)) return true;
  if (/^\s*No\b/im.test(raw)) return true;
  return false;
}
