import { mkdirSync, writeFileSync, existsSync } from "node:fs";
import { join, resolve } from "node:path";
import { randomUUID } from "node:crypto";

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
import { notifyWallet } from "./notify.js";
import { renderAresDefenseReportPdf } from "./report-pdf.js";
import {
  appendTraceEvent,
  getRunBrief,
  insertPdfReportRecord,
  listFindingsForRun,
  recordFinding,
  refundDebit,
  settleDebit,
  setRunStatus,
} from "./runs.js";

function repoRoot(): string {
  const env = process.env.ASST_REPO_ROOT?.trim();
  if (env) return resolve(env);
  const cwd = resolve(process.cwd());
  if (existsSync(join(cwd, "pnpm-workspace.yaml"))) {
    return cwd;
  }
  return resolve(cwd, "../..");
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
    await notifyWallet({
      pool,
      wallet: payload.wallet ?? undefined,
      kind: "scan_complete",
      title: "Scan completed",
      body: `Run ${payload.runId.slice(0, 8)}… finished successfully.`,
      relatedRunId: payload.runId,
    }).catch(() => {});
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
    await notifyWallet({
      pool,
      wallet: payload.wallet ?? undefined,
      kind: "scan_failed",
      title: "Scan failed",
      body: msg.slice(0, 500),
      relatedRunId: payload.runId,
    }).catch(() => {});
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

  try {
    const findings = await listFindingsForRun(pool, payload.parentRunId);
    const parentRun = await getRunBrief(pool, payload.parentRunId);
    const parentShort = payload.parentRunId.slice(0, 8);
    const scanTarget =
      parentRun?.kind === "scan" && parentRun.target?.trim()
        ? parentRun.target.trim()
        : null;
    const headline = scanTarget
      ? `Findings from repo ${scanTarget}`
      : `Findings from run ${parentShort}`;
    const reportTitle = `${headline} (${parentShort}...)`;

    const pdfBytes = renderAresDefenseReportPdf({
      headline,
      parentRunId: payload.parentRunId,
      scanTarget,
      findings,
    });
    const buf = Buffer.from(pdfBytes);
    const reportId = randomUUID();
    const reportsDir = join(repoRoot(), ".asst", "reports");
    if (!existsSync(reportsDir)) {
      mkdirSync(reportsDir, { recursive: true });
    }
    const relativeKey = join(".asst", "reports", `${reportId}.pdf`);
    const absPath = join(repoRoot(), ".asst", "reports", `${reportId}.pdf`);
    writeFileSync(absPath, buf);

    await insertPdfReportRecord({
      pool,
      reportId,
      synthesisRunId: payload.runId,
      wallet: payload.wallet,
      title: reportTitle,
      summary: scanTarget
        ? `${findings.length} finding(s) synthesized from scan target "${scanTarget}".`
        : `${findings.length} finding(s) from parent run ${parentShort}.`,
      objectKey: relativeKey.replace(/\\/g, "/"),
      bucket: "local-fs",
      bytes: buf.byteLength,
      meta: {
        parentRunId: payload.parentRunId,
        parentKind: parentRun?.kind ?? null,
        scanTarget,
      },
    });

    await appendTraceEvent({
      pool,
      runId: payload.runId,
      event: {
        ts: Date.now(),
        layer: "orchestrator",
        agent: "report_synthesizer",
        kind: "result",
        message: "report pdf written",
        meta: { reportId, parentRunId: payload.parentRunId },
      },
    });

    await setRunStatus({ pool, id: payload.runId, status: "succeeded", unitsBilled: 2 });
    if (payload.provisionalDebitId !== undefined) {
      await settleDebit(pool, payload.provisionalDebitId);
    }

    await notifyWallet({
      pool,
      wallet: payload.wallet ?? undefined,
      kind: "report_ready",
      title: "Report ready",
      body: `Download report ${reportId.slice(0, 8)}… from the Reports tab.`,
      relatedRunId: payload.runId,
    }).catch(() => {});
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    await setRunStatus({ pool, id: payload.runId, status: "failed", error: msg });
    await recordFinding({
      pool,
      runId: payload.runId,
      agent: "report_synthesizer",
      layer: "orchestrator",
      severity: "high",
      title: "Report synthesis failed",
      detail: { error: msg },
    });
    if (payload.provisionalDebitId !== undefined) {
      await refundDebit(pool, payload.provisionalDebitId);
    }
    throw err;
  }
}
