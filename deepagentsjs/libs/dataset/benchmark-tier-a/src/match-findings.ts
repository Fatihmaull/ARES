/**
 * Semi-automatic matching of agent report text to ground-truth set G.
 * Heuristic: token Jaccard on description + cwe_like overlap + keyword hits.
 * Disputed cases per plan: resolve with two human reviewers (out of band).
 */
import { textAgreesVulnerableReference } from "./text-agrees.js";
import type { BenchmarkEntry, GroundTruthFinding } from "./types.js";

const STOP = new Set(
  "a an the and or for to of in on at is are was were be been being with as by from that this it its".split(
    " ",
  ),
);

function tokenize(s: string): Set<string> {
  const t = s
    .toLowerCase()
    .replace(/[^a-z0-9_]+/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 1 && !STOP.has(w));
  return new Set(t);
}

function jaccard(a: Set<string>, b: Set<string>): number {
  let inter = 0;
  for (const x of a) {
    if (b.has(x)) inter += 1;
  }
  const union = a.size + b.size - inter;
  return union === 0 ? 0 : inter / union;
}

export interface AgentChunk {
  raw: string;
  scoreTags: string[];
}

/** Crude chunking: split on markdown ## / ### and take substantial blocks. */
export function chunkAgentReport(text: string): AgentChunk[] {
  const parts = text.split(/\n(?=#{1,3}\s)/g);
  const out: AgentChunk[] = [];
  for (const p of parts) {
    const raw = p.trim();
    if (raw.length < 40) continue;
    const low = raw.toLowerCase();
    const scoreTags: string[] = [];
    if (/\bvulnerabilit/i.test(raw)) scoreTags.push("vuln_word");
    if (/\b(cwe|exploit|attack|drain|reentr|overflow|bypass|forge|signer|pda|cpi)\b/i.test(raw))
      scoreTags.push("sec_terms");
    if (low.includes("finding") || low.includes("issue") || low.includes("risk"))
      scoreTags.push("finding_headers");
    out.push({ raw, scoreTags });
  }
  if (out.length === 0 && text.length > 40) {
    out.push({ raw: text, scoreTags: ["full_doc"] });
  }
  return out;
}

function combinedText(g: GroundTruthFinding): string {
  return [g.cwe_like, g.location_hint, g.description].filter(Boolean).join(" ");
}

/**
 * For each ground-truth item, true if any chunk matches above threshold.
 * Returns matched ground indices and which chunks were consumed.
 */
export function matchGroundTruth(
  report: string,
  G: GroundTruthFinding[],
  opts: { jaccardMin?: number } = {},
): { tp: number; fn: number; matchedG: number[]; fpCandidates: string[] } {
  const jaccardMin = opts.jaccardMin ?? 0.12;
  const chunks = chunkAgentReport(report);
  const matchedG: number[] = [];
  const usedChunk = new Set<number>();

  for (let gi = 0; gi < G.length; gi++) {
    const g = G[gi]!;
    const gTokens = tokenize(combinedText(g));
    let best = 0;
    let bestIdx = -1;
    for (let ci = 0; ci < chunks.length; ci++) {
      if (usedChunk.has(ci)) continue;
      const c = chunks[ci]!;
      const j = jaccard(gTokens, tokenize(c.raw));
      const cweHit = g.cwe_like
        .toLowerCase()
        .split(/[^a-z0-9_]+/i)
        .some(
          (w) =>
            w.length > 2 && c.raw.toLowerCase().includes(w.toLowerCase()),
        );
      const score = j + (cweHit ? 0.25 : 0) + (c.scoreTags.includes("vuln_word") ? 0.05 : 0);
      if (score > best) {
        best = score;
        bestIdx = ci;
      }
    }
    if (best >= jaccardMin && bestIdx >= 0) {
      matchedG.push(gi);
      usedChunk.add(bestIdx);
    }
  }

  const fn = G.length - matchedG.length;
  const fpCandidates: string[] = [];
  for (let ci = 0; ci < chunks.length; ci++) {
    if (usedChunk.has(ci)) continue;
    const c = chunks[ci]!;
    if (
      c.scoreTags.includes("vuln_word") ||
      c.scoreTags.includes("sec_terms")
    ) {
      fpCandidates.push(c.raw.slice(0, 500));
    }
  }

  const tp = matchedG.length;
  return { tp, fn, matchedG, fpCandidates };
}

/**
 * Count false positives: chunks that look like extra findings (not used for TP).
 * Upper bound: length of fpCandidates (each may be a distinct spurious claim).
 */
export function estimateFpCount(fpCandidates: string[]): number {
  return Math.min(fpCandidates.length, 20);
}

export function reportImpliesVulnerability(report: string): boolean {
  return textAgreesVulnerableReference(report);
}

/** For negative controls: any vuln claim in prose is a false positive signal. */
export function scoreNegativeControl(entry: BenchmarkEntry, report: string): {
  fp?: number;
  alert: boolean;
} {
  if (!entry.negative_controls) return { alert: false };
  if (entry.ground_truth_findings.length > 0) {
    return { alert: true, fp: undefined };
  }
  const claims = reportImpliesVulnerability(report);
  return { alert: claims, fp: claims ? 1 : 0 };
}
