import { resolve } from "node:path";

import { Orchestrator } from "@ares/engine";
import type {
  AnyJobPayload,
  ChatJobPayload,
  JobHandler,
  JobMeta,
  ReportJobPayload,
  ScanJobPayload,
  ToolJobPayload,
} from "@ares/queue";

import { getPool } from "./db.js";
import {
  appendTraceEvent,
  recordFinding,
  refundDebit,
  setRunStatus,
  settleDebit,
} from "./runs.js";

function repoRoot(): string {
  return process.env.ASST_REPO_ROOT?.trim() || resolve(process.cwd());
}

export const dispatchJob: JobHandler = async (payload: AnyJobPayload, meta: JobMeta) => {
  switch (payload.kind) {
    case "scan-full":
      return runScan(payload, meta);
    case "chat-async":
      return runChat(payload, meta);
    case "tool-heavy":
      return runTool(payload, meta);
    case "report-synth":
      return runReport(payload, meta);
    default: {
      const _exhaustive: never = payload;
      throw new Error(`Unknown job kind: ${(_exhaustive as { kind?: string }).kind ?? "unknown"}`);
    }
  }
};

async function runScan(payload: ScanJobPayload, meta: JobMeta): Promise<void> {
  const pool = getPool();
  await setRunStatus({ pool, id: payload.runId, status: "running" });
  await appendTraceEvent({
    pool,
    runId: payload.runId,
    event: {
      ts: Date.now(),
      layer: "orchestrator",
      agent: "scan-runner",
      kind: "dispatch",
      meta: { attempt: meta.attempt, target: payload.target },
    },
  });

  let unitsBilled: number | null = null;
  try {
    const orchestrator = new Orchestrator(repoRoot(), { model: payload.model });

    await orchestrator.runFullScan((agent, status) => {
      void appendTraceEvent({
        pool,
        runId: payload.runId,
        event: {
          ts: Date.now(),
          layer: "sub_agent",
          agent,
          kind: status === "running" ? "tool_start" : status === "completed" ? "result" : "error",
          message: typeof status === "string" ? status : String(status),
        },
      }).catch(() => {});
    });

    unitsBilled = 10;
    await setRunStatus({ pool, id: payload.runId, status: "succeeded", unitsBilled });
    if (payload.provisionalDebitId !== undefined) {
      await settleDebit(pool, payload.provisionalDebitId);
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    await setRunStatus({ pool, id: payload.runId, status: "failed", error: msg });
    await recordFinding({
      pool,
      runId: payload.runId,
      agent: "scan-runner",
      layer: "orchestrator",
      severity: "high",
      title: "Scan failed",
      detail: { error: msg },
    });
    if (payload.provisionalDebitId !== undefined) {
      await refundDebit(pool, payload.provisionalDebitId);
    }
    throw err;
  }
}

async function runChat(payload: ChatJobPayload, _meta: JobMeta): Promise<void> {
  const pool = getPool();
  await setRunStatus({ pool, id: payload.runId, status: "running" });
  try {
    const orchestrator = new Orchestrator(repoRoot(), { model: payload.model });
    const out = await orchestrator.chat(payload.prompt);
    await appendTraceEvent({
      pool,
      runId: payload.runId,
      event: {
        ts: Date.now(),
        layer: "orchestrator",
        agent: "chat",
        kind: "result",
        meta: { length: out?.length ?? 0 },
      },
    });
    await setRunStatus({
      pool,
      id: payload.runId,
      status: "succeeded",
      unitsBilled: 1,
    });
    if (payload.provisionalDebitId !== undefined) {
      await settleDebit(pool, payload.provisionalDebitId);
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    await setRunStatus({ pool, id: payload.runId, status: "failed", error: msg });
    if (payload.provisionalDebitId !== undefined) {
      await refundDebit(pool, payload.provisionalDebitId);
    }
    throw err;
  }
}

async function runTool(payload: ToolJobPayload, _meta: JobMeta): Promise<void> {
  const pool = getPool();
  await setRunStatus({ pool, id: payload.runId, status: "running" });
  // Heavy/Premium tool path is wired in P5 (Wave A skills) — for now we record
  // the request and mark succeeded so credits don't get stuck.
  await appendTraceEvent({
    pool,
    runId: payload.runId,
    event: {
      ts: Date.now(),
      layer: "worker",
      agent: payload.toolName,
      kind: "result",
      message: "tool execution stubbed",
      meta: { costClass: payload.costClass, args: payload.args },
    },
  });
  await setRunStatus({ pool, id: payload.runId, status: "succeeded", unitsBilled: 1 });
  if (payload.provisionalDebitId !== undefined) {
    await settleDebit(pool, payload.provisionalDebitId);
  }
}

async function runReport(payload: ReportJobPayload, _meta: JobMeta): Promise<void> {
  const pool = getPool();
  await setRunStatus({ pool, id: payload.runId, status: "running" });
  // Report synthesis from a parent run is wired alongside object storage in P6.
  await appendTraceEvent({
    pool,
    runId: payload.runId,
    event: {
      ts: Date.now(),
      layer: "orchestrator",
      agent: "report_synthesizer",
      kind: "result",
      message: "report synthesis stubbed",
      meta: { parentRunId: payload.parentRunId },
    },
  });
  await setRunStatus({ pool, id: payload.runId, status: "succeeded", unitsBilled: 2 });
  if (payload.provisionalDebitId !== undefined) {
    await settleDebit(pool, payload.provisionalDebitId);
  }
}
