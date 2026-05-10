"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Calendar,
  CheckCircle2,
  Download,
  FileText,
  Loader2,
  RefreshCw,
  Search,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { safeResponseJson } from "@/lib/safe-response-json";

interface ReportDto {
  id: string;
  name: string;
  type: string;
  date: string;
  status: string;
  path: string;
  /** Server-suggested .pdf filename from report title */
  fileName?: string;
  summary: string | null;
  runId: string | null;
}

interface RunDto {
  id: string;
  kind: string;
  status: "queued" | "running" | "succeeded" | "failed" | "canceled";
  target: string | null;
  createdAt: string;
  finishedAt: string | null;
}

interface PendingSynth {
  reportRunId: string;
  parentRunId: string;
  status: RunDto["status"];
}

const POLL_MS = 4000;

export default function ReportsPage() {
  const [reports, setReports] = useState<ReportDto[]>([]);
  const [runs, setRuns] = useState<RunDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [selectedRunId, setSelectedRunId] = useState<string>("");
  const [pending, setPending] = useState<PendingSynth[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const loadReports = useCallback(async () => {
    try {
      const res = await fetch("/api/reports?limit=50", { cache: "no-store" });
      const body = await safeResponseJson<{
        ok?: boolean;
        data?: { reports?: ReportDto[] };
        error?: { message?: string };
      }>(res);
      if (!res.ok || !body?.ok) {
        setError(body?.error?.message ?? `Reports request failed (${res.status}).`);
        return;
      }
      setReports(body.data?.reports ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }, []);

  const loadRuns = useCallback(async () => {
    try {
      const res = await fetch("/api/runs?limit=100", { cache: "no-store" });
      const body = await safeResponseJson<{
        ok?: boolean;
        data?: { runs?: RunDto[] };
      }>(res);
      if (res.ok && body?.ok) {
        setRuns(body.data?.runs ?? []);
      }
    } catch {
      // Non-fatal: list is just a picker.
    }
  }, []);

  const loadAll = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      await Promise.all([loadReports(), loadRuns()]);
    } finally {
      setLoading(false);
    }
  }, [loadReports, loadRuns]);

  useEffect(() => {
    void loadAll();
  }, [loadAll]);

  const succeededScans = useMemo(
    () =>
      runs.filter((r) => r.kind === "scan" && r.status === "succeeded"),
    [runs],
  );

  useEffect(() => {
    if (succeededScans.length === 0) {
      setSelectedRunId("");
      return;
    }
    setSelectedRunId((prev) =>
      prev && succeededScans.some((r) => r.id === prev)
        ? prev
        : succeededScans[0]!.id,
    );
  }, [succeededScans]);

  // Poll any pending synthesis runs.
  useEffect(() => {
    if (pending.length === 0) {
      if (pollRef.current) {
        clearInterval(pollRef.current);
        pollRef.current = null;
      }
      return;
    }
    if (pollRef.current) return;
    pollRef.current = setInterval(async () => {
      const next: PendingSynth[] = [];
      let touchedReports = false;
      for (const p of pending) {
        try {
          const res = await fetch(`/api/runs/${encodeURIComponent(p.reportRunId)}`, {
            cache: "no-store",
          });
          const body = await safeResponseJson<{
            ok?: boolean;
            data?: { status?: RunDto["status"] };
          }>(res);
          const status = body?.data?.status ?? p.status;
          if (status === "succeeded") {
            touchedReports = true;
            continue;
          }
          if (status === "failed" || status === "canceled") {
            setError(`Report run ${p.reportRunId.slice(0, 8)} ${status}.`);
            continue;
          }
          next.push({ ...p, status });
        } catch {
          next.push(p);
        }
      }
      setPending(next);
      if (touchedReports) await loadReports();
    }, POLL_MS);
    return () => {
      if (pollRef.current) {
        clearInterval(pollRef.current);
        pollRef.current = null;
      }
    };
  }, [pending, loadReports]);

  async function handleSynthesize() {
    if (!selectedRunId) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/reports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ parentRunId: selectedRunId }),
      });
      const body = await safeResponseJson<{
        ok?: boolean;
        data?: { runId?: string };
        error?: { message?: string };
      }>(res);
      if (!res.ok || !body?.ok || !body.data?.runId) {
        setError(body?.error?.message ?? `Failed (${res.status}).`);
        return;
      }
      setPending((prev) => [
        ...prev,
        {
          reportRunId: body.data!.runId!,
          parentRunId: selectedRunId,
          status: "queued",
        },
      ]);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSubmitting(false);
    }
  }

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return reports;
    return reports.filter((r) =>
      [r.name, r.type, r.summary ?? "", r.id].some((field) =>
        field?.toLowerCase().includes(q),
      ),
    );
  }, [reports, search]);

  async function handleReportDownload(report: ReportDto) {
    setError(null);
    try {
      const res = await fetch(report.path, { credentials: "include" });
      const ct = res.headers.get("content-type") ?? "";
      if (!res.ok || ct.includes("application/json")) {
        let msg = `Download failed (${res.status}).`;
        try {
          const j = (await res.json()) as {
            error?: { message?: string; details?: string };
          };
          msg = j?.error?.message ?? msg;
          if (j?.error?.details) msg = `${msg} (${j.error.details})`;
        } catch {
          /* ignore */
        }
        setError(msg);
        return;
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const fallback = `ARES-findings-${report.id.slice(0, 8)}.pdf`;
      const name =
        report.fileName && report.fileName.toLowerCase().endsWith(".pdf")
          ? report.fileName
          : fallback;
      const a = document.createElement("a");
      a.href = url;
      a.download = name;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  return (
    <div className="space-y-12 animate-in fade-in slide-in-from-bottom-2 duration-700">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 overflow-hidden">
        <div>
          <p className="text-[12px] font-sans font-semibold text-primary uppercase tracking-[0.2em] mb-3">
            Evidence & Documentation
          </p>
          <h1 className="text-5xl font-serif font-medium tracking-tight text-foreground mb-4">
            Reports
          </h1>
          <p className="text-lg text-muted-foreground max-w-2xl leading-relaxed">
            Synthesize a PDF from any successful scan run. Reports persist in
            object storage and stream via signed URLs or local-fs.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void loadAll()}
          className="flex items-center gap-2 px-5 py-2.5 bg-secondary text-secondary-foreground border border-border rounded-xl text-[14px] font-medium hover:bg-muted transition-all shrink-0"
        >
          <RefreshCw className={cn("w-4 h-4", loading && "animate-spin")} />
          Refresh
        </button>
      </div>

      {error && (
        <div className="rounded-xl border border-destructive/30 bg-destructive/10 px-5 py-4 text-[14px] text-destructive">
          {error}
        </div>
      )}

      <div className="ares-card p-8 whisper-shadow bg-secondary/30">
        <h3 className="text-2xl font-serif font-medium mb-4 flex items-center gap-3">
          <FileText className="w-6 h-6 text-primary" />
          Synthesize from a run
        </h3>
        <p className="text-muted-foreground text-[15px] leading-relaxed mb-6">
          Pick a successful scan and we&apos;ll generate a PDF that lists its
          findings. Costs <strong>2 units</strong>; the worker emits a
          notification when ready.
        </p>
        <div className="flex flex-col md:flex-row gap-4">
          <select
            value={selectedRunId}
            onChange={(e) => setSelectedRunId(e.target.value)}
            disabled={succeededScans.length === 0}
            className="flex-1 bg-card border border-border rounded-xl px-4 py-3 text-[14px]"
          >
            {succeededScans.length === 0 ? (
              <option value="">No succeeded scans yet</option>
            ) : (
              succeededScans.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.id.slice(0, 8)}… — {r.target ?? "(no target)"} —{" "}
                  {new Date(r.createdAt).toLocaleString()}
                </option>
              ))
            )}
          </select>
          <button
            type="button"
            onClick={() => void handleSynthesize()}
            disabled={submitting || !selectedRunId}
            className="px-6 py-3 bg-primary text-primary-foreground rounded-xl text-[14px] font-medium hover:bg-primary/90 disabled:opacity-50 flex items-center gap-2"
          >
            {submitting ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <FileText className="w-4 h-4" />
            )}
            Start synthesis
          </button>
        </div>

        {pending.length > 0 && (
          <ul className="mt-6 space-y-2 text-[13px]">
            {pending.map((p) => (
              <li
                key={p.reportRunId}
                className="flex items-center gap-3 text-muted-foreground"
              >
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                Run {p.reportRunId.slice(0, 8)}… ({p.status}) — synthesizing
                from parent {p.parentRunId.slice(0, 8)}…
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="space-y-6">
        <div className="flex items-center justify-between border-b border-border pb-4">
          <h2 className="text-2xl font-serif font-medium">Recent reports</h2>
          <div className="px-3 py-1.5 bg-secondary/30 rounded-lg border border-border flex items-center gap-2 focus-within:ring-1 focus-within:ring-primary/20 transition-all">
            <Search className="w-3.5 h-3.5 text-muted-foreground" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Filter reports…"
              className="bg-transparent border-none text-xs w-48 focus:ring-0"
            />
          </div>
        </div>

        <div className="ares-card whisper-shadow divide-y divide-border overflow-hidden">
          {loading && filtered.length === 0 ? (
            [1, 2, 3].map((i) => (
              <div
                key={i}
                className="p-6 bg-secondary/5 animate-pulse flex gap-6"
              >
                <div className="w-12 h-12 rounded-xl bg-muted" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 bg-muted w-1/3" />
                  <div className="h-3 bg-muted w-1/4" />
                </div>
              </div>
            ))
          ) : filtered.length === 0 ? (
            <div className="p-12 text-center text-muted-foreground italic font-serif">
              No reports yet. Synthesize one above.
            </div>
          ) : (
            filtered.map((report) => (
              <div
                key={report.id}
                className="p-6 flex flex-col md:flex-row md:items-center gap-6 group hover:bg-secondary/10 transition-colors"
              >
                <div className="w-12 h-12 rounded-xl bg-card border border-border flex items-center justify-center shadow-sm group-hover:border-primary/20 transition-all">
                  <FileText className="w-5 h-5 text-primary" />
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-3 mb-1 flex-wrap">
                    <h4 className="text-lg font-serif font-medium truncate group-hover:text-primary transition-colors leading-tight">
                      {report.name}
                    </h4>
                    {report.status === "verified" && (
                      <span className="flex items-center gap-1 text-[10px] font-bold text-emerald-600 uppercase tracking-widest px-2 py-0.5 bg-emerald-500/10 border border-emerald-500/10 rounded-full">
                        <CheckCircle2 className="w-2.5 h-2.5" />
                        Verified
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-6 text-[13px] text-muted-foreground font-sans flex-wrap">
                    <span className="flex items-center gap-1.5 capitalize">
                      <FileText className="w-3.5 h-3.5" />
                      {report.type.replace("_", " ")}
                    </span>
                    <span className="flex items-center gap-1.5">
                      <Calendar className="w-3.5 h-3.5" />
                      {report.date}
                    </span>
                    {report.summary && (
                      <span className="opacity-70 truncate max-w-[320px]">
                        {report.summary}
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => void handleReportDownload(report)}
                    className="px-4 py-2 border border-border rounded-xl text-[12px] font-medium hover:bg-secondary/50 transition-all flex items-center gap-2"
                  >
                    <Download className="w-3.5 h-3.5 text-primary" />
                    Download PDF
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
