export type BenchmarkTier = "A" | "B";

export interface GroundTruthFinding {
  cwe_like: string;
  location_hint?: string;
  description: string;
  maps_to_evidence?: string;
}

export interface BenchmarkArtifact {
  type: "source_tree" | "git_ref" | "url" | "none";
  ref: string;
  path?: string;
}

export interface BenchmarkEntry {
  id: string;
  ecosystem: "solana-anchor" | "solana-native" | "other";
  benchmark_tier: BenchmarkTier;
  negative_controls: boolean;
  severity?: string;
  category?: string;
  primary_evidence_urls: string[];
  evidence_types: string[];
  ground_truth_findings: GroundTruthFinding[];
  artifact: BenchmarkArtifact;
  local_project_path?: string | null;
  notes?: string;
}

export interface ScoredEntry {
  id: string;
  benchmark_tier: BenchmarkTier;
  negative_controls: boolean;
  tp: number;
  fp: number;
  fn: number;
  precision: number;
  recall: number;
  f1: number;
  /** Wall-clock for batch run, if present in manifest */
  durationMs?: number;
  /** Optional: agent reported vulnerability (for NC rows) */
  anyAgentClaimVuln?: boolean;
}

export interface RunManifest {
  runId: string;
  createdAt: string;
  /** Git commit of deepagentsjs at run time, if `git` available */
  monorepoCommit?: string;
  /** Optional: tag or version string for agent stack */
  agentVersion?: string;
  command: string;
  entries: { id: string; path: string; status: "ok" | "skipped" | "error"; durationMs?: number; error?: string }[];
}
