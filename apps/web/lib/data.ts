import { readdirSync, readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { resolveRepoRoot } from "./paths";

// ─── Posture Score Computation ──────────────────────────────────────

interface LayerScore {
  name: string;
  score: number;
  grade: string;
}

function computeGrade(score: number): string {
  if (score >= 90) return "A";
  if (score >= 80) return "B";
  if (score >= 70) return "C";
  if (score >= 60) return "D";
  return "F";
}

function computePostureScore(latest: any, supplyChain: any, assuranceDir: string) {
  const layers: LayerScore[] = [];

  // L1: Secret Hygiene — from scan results
  let secretScore = 100;
  const scanPath = join(assuranceDir, "..", ".asst", "last-scan.json");
  if (existsSync(scanPath)) {
    try {
      const scan = JSON.parse(readFileSync(scanPath, "utf8"));
      const secretResult = scan.results?.find((r: any) => r.agent === "secret_hygiene_scanner");
      if (secretResult?.output?.includes("EXPOSURE") || secretResult?.output?.includes("WARNING")) {
        secretScore = 30;
      }
    } catch (error) {
      console.warn("Failed to parse last-scan.json for secret score:", error);
    }
  }
  layers.push({ name: "L1 Secret Hygiene", score: secretScore, grade: computeGrade(secretScore) });

  // L2: Static Analysis (Semgrep) — from manifest
  let saScore = 100;
  const sarifPath = join(assuranceDir, "merged.sarif.json");
  if (existsSync(sarifPath)) {
    try {
      const sarif = JSON.parse(readFileSync(sarifPath, "utf8"));
      const count = sarif?.runs?.[0]?.results?.length || 0;
      saScore = Math.max(0, 100 - count * 10);
    } catch (error) {
      console.warn("Failed to parse merged.sarif.json for static analysis score:", error);
    }
  } else if (latest?.static_analysis?.semgrep?.status === "ok") {
    saScore = 95;
  }
  layers.push({ name: "L2 Static Analysis", score: saScore, grade: computeGrade(saScore) });

  // L3: Chain State — from snapshots
  let chainScore = 50;
  const snapshotDir = join(assuranceDir, "snapshots");
  if (existsSync(snapshotDir)) {
    const count = readdirSync(snapshotDir).filter(f => f.endsWith(".json")).length;
    chainScore = count > 0 ? 85 : 50;
  }
  layers.push({ name: "L3 Chain State", score: chainScore, grade: computeGrade(chainScore) });

  // L4: DeFi / Rug Pull — from scan results
  let defiScore = 80;
  if (existsSync(scanPath)) {
    try {
      const scan = JSON.parse(readFileSync(scanPath, "utf8"));
      const rug = scan.results?.find((r: any) => r.agent === "rug_pull_detector");
      if (rug?.output?.includes("WARNING") || rug?.output?.includes("Critical")) {
        defiScore = 40;
      } else if (rug) {
        defiScore = 90;
      }
    } catch (error) {
      console.warn("Failed to parse last-scan.json for DeFi score:", error);
    }
  }
  layers.push({ name: "L4 DeFi / Rug Pull", score: defiScore, grade: computeGrade(defiScore) });

  // L5: Supply Chain — from supply-chain-merged.json
  let scScore = 100;
  if (supplyChain) {
    const total = supplyChain?.npm?.vulnerabilities?.total || 0;
    const criticals = supplyChain?.npm?.vulnerabilities?.critical || 0;
    const highs = supplyChain?.npm?.vulnerabilities?.high || 0;
    scScore = Math.max(0, 100 - criticals * 25 - highs * 15 - (total - criticals - highs) * 5);
  }
  layers.push({ name: "L5 Supply Chain", score: scScore, grade: computeGrade(scScore) });

  // L6: Report Coverage — from manifest count
  const manifests = existsSync(assuranceDir)
    ? readdirSync(assuranceDir).filter(f => /^run-.*\.json$/.test(f))
    : [];
  const reportScore = manifests.length > 0 ? 90 : 50;
  layers.push({ name: "L6 Report Coverage", score: reportScore, grade: computeGrade(reportScore) });

  // Weighted aggregate
  const weights = [0.20, 0.20, 0.15, 0.15, 0.20, 0.10];
  const overall = Math.round(layers.reduce((sum, l, i) => sum + l.score * weights[i], 0));

  return { overall, grade: computeGrade(overall), layers };
}

// ─── Main Data Loader ───────────────────────────────────────────────

export function getAssuranceData() {
  const assuranceDir = join(resolveRepoRoot(), "assurance");
  
  if (!existsSync(assuranceDir)) {
    return { 
      manifests: [], 
      latest: null, 
      supplyChain: null, 
      posture: { overall: 0, grade: "—", layers: [] }
    };
  }

  try {
    const files = readdirSync(assuranceDir);
    const manifests = files
      .filter((file) => file.match(/^run-.*\.json$/))
      .map((file) => {
        const path = join(assuranceDir, file);
        const data = JSON.parse(readFileSync(path, "utf8"));
        return { file, ...data };
      })
      .sort((a, b) => {
        return new Date(b.generated_at || 0).getTime() - new Date(a.generated_at || 0).getTime();
      });

    const supplyChainPath = join(assuranceDir, "supply-chain-merged.json");
    let supplyChain = null;
    if (existsSync(supplyChainPath)) {
      supplyChain = JSON.parse(readFileSync(supplyChainPath, "utf8"));
    }

    const latest = manifests[0] || null;
    const posture = computePostureScore(latest, supplyChain, assuranceDir);

    return {
      manifests,
      latest,
      supplyChain,
      posture,
    };
  } catch (error) {
    console.error("Error reading manifests:", error);
    return { 
      manifests: [], 
      latest: null, 
      supplyChain: null,
      posture: { overall: 0, grade: "—", layers: [] }
    };
  }
}

