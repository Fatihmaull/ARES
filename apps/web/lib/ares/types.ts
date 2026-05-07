export type TargetKind =
  | "solana_program"
  | "evm_contract"
  | "github_repo"
  | "domain"
  | "wallet";

export interface Target {
  id: string;
  wallet: string;
  kind: TargetKind;
  identifier: string;
  label: string | null;
  createdAt: string;
  lastScannedAt: string | null;
  lastRunId: string | null;
  archivedAt: string | null;
}

export type FindingStatus = "open" | "acknowledged" | "resolved" | "wont_fix";

export interface Finding {
  id?: string;
  source: string;
  severity: string;
  rule: string;
  message: string;
  location?: string;
  line?: number;
  runId?: string | null;
  status?: FindingStatus;
  resolvedAt?: string | null;
  resolvedByWallet?: string | null;
  notes?: string | null;
  createdAt?: string;
}

export interface Detection extends Finding {}

export interface Agent {
  id: string;
  name: string;
  type: string;
  status: "idle" | "running" | "error";
  lastRun: string;
  successRate: number | null;
  currentTask?: string;
  model: string;
  inFlight?: number;
}

export interface RunSummary {
  id: string;
  kind: string;
  status: string;
  target: string | null;
  model: string | null;
  unitsBilled?: number | null;
  createdAt: string;
  startedAt?: string | null;
  finishedAt?: string | null;
  durationMs?: number | null;
}

export interface NotificationItem {
  id: string;
  kind: string;
  title: string;
  body: string | null;
  relatedRunId: string | null;
  relatedPurchaseId: string | null;
  relatedFindingId: string | null;
  createdAt: string;
  readAt: string | null;
}
