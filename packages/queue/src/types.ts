export type ScanTarget = string;

export interface ScanJobPayload {
  kind: "scan-full";
  runId: string;
  requestId: string;
  wallet: string | null; // null for operator runs
  target: ScanTarget;
  model?: string;
  /** Provisional debit row id created by web; worker settles or refunds based on terminal state. */
  provisionalDebitId?: number;
}

export interface ChatJobPayload {
  kind: "chat-async";
  runId: string;
  requestId: string;
  wallet: string | null;
  prompt: string;
  model?: string;
  provisionalDebitId?: number;
}

export interface ToolJobPayload {
  kind: "tool-heavy";
  runId: string;
  requestId: string;
  wallet: string | null;
  toolName: string;
  args: Record<string, unknown>;
  costClass: "A" | "B" | "C" | "D";
  provisionalDebitId?: number;
}

export interface ReportJobPayload {
  kind: "report-synth";
  runId: string;
  requestId: string;
  wallet: string | null;
  /** Run id of the parent that produced the findings to synthesize. */
  parentRunId: string;
  provisionalDebitId?: number;
}

export type AnyJobPayload =
  | ScanJobPayload
  | ChatJobPayload
  | ToolJobPayload
  | ReportJobPayload;

export interface JobMeta {
  attempts?: number;
  attempt?: number;
  jobId?: string;
}

export type JobHandler<T extends AnyJobPayload = AnyJobPayload> = (
  payload: T,
  meta: JobMeta,
) => Promise<void>;

export interface EnqueueResult {
  jobId: string;
  queued: boolean;
  inline: boolean;
}

export interface QueueClient {
  enqueue<T extends AnyJobPayload>(
    payload: T,
    opts?: {
      jobId?: string;
      delayMs?: number;
      attempts?: number;
    },
  ): Promise<EnqueueResult>;
  /** Close underlying connections. */
  close(): Promise<void>;
}

export const DEFAULT_QUEUE_NAME = "ares-jobs";
