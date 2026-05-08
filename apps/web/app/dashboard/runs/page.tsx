"use client";

import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import {
  AlertCircle,
  CheckCircle2,
  Clock,
  FileText,
  History,
  Loader2,
  RefreshCw,
  X,
  XCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { safeResponseJson } from "@/lib/safe-response-json";

type RunStatus = "queued" | "running" | "succeeded" | "failed" | "canceled";

interface RunDto {
  id: string;
  kind: string;
  status: RunStatus;
  target: string | null;
  model: string | null;
  unitsBilled: number | null;
  createdAt: string;
  startedAt: string | null;
  finishedAt: string | null;
  error: string | null;
}

interface RunDetailDto extends RunDto {
  trace: Array<{
    ts?: number;
    layer?: string;
    agent?: string;
    kind?: string;
    message?: string;
    meta?: Record<string, unknown>;
  }>;
  meta: Record<string, unknown>;
  requestId: string | null;
}

const POLL_MS = 5000;

export default function RunsPage() {
  return (
    <Suspense fallback={null}>
      <RunsPageInner />
    </Suspense>
  );
}

function RunsPageInner() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const focusedId = searchParams.get("run");

  const [runs, setRuns] = useState<RunDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/runs?limit=100", { cache: "no-store" });
      const body = await safeResponseJson<{
        ok?: boolean;
        data?: { runs?: RunDto[] };
        error?: { message?: string };
      }>(res);
      if (!res.ok || !body?.ok) {
        setError(body?.error?.message ?? `Request failed (${res.status}).`);
        setRuns([]);
        return;
      }
      setRuns(body.data?.runs ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    const hasInflight = runs.some(
      (r) => r.status === "queued" || r.status === "running",
    );
    if (!hasInflight) return;
    const t = setInterval(() => {
      void load();
    }, POLL_MS);
    return () => clearInterval(t);
  }, [runs, load]);

  const closeDrawer = () => {
    const params = new URLSearchParams(searchParams.toString());
    params.delete("run");
    router.replace(
      `/dashboard/runs${params.toString() ? `?${params.toString()}` : ""}`,
    );
  };

  const openDrawer = (id: string) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("run", id);
    router.replace(`/dashboard/runs?${params.toString()}`);
  };

  return (
    <div className="space-y-12 animate-in fade-in slide-in-from-bottom-2 duration-700">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div>
          <p className="text-[12px] font-sans font-semibold text-primary uppercase tracking-[0.2em] mb-3">
            Execution Ledger
          </p>
          <h1 className="text-5xl font-serif font-medium tracking-tight text-foreground mb-4">
            Runs
          </h1>
          <p className="text-lg text-muted-foreground max-w-2xl leading-relaxed">
            Every scan, chat, tool, or report-synthesis enqueued by your wallet.
            In-flight runs poll every {POLL_MS / 1000}s.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void load()}
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

      <div className="ares-card whisper-shadow overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-[14px]">
            <thead>
              <tr className="border-b border-border bg-secondary/20">
                <th className="px-6 py-4 font-serif font-medium">Run</th>
                <th className="px-6 py-4 font-serif font-medium">Kind</th>
                <th className="px-6 py-4 font-serif font-medium">Status</th>
                <th className="px-6 py-4 font-serif font-medium">Target</th>
                <th className="px-6 py-4 font-serif font-medium">Created</th>
                <th className="px-6 py-4 font-serif font-medium">Finished</th>
                <th className="px-6 py-4 font-serif font-medium text-right">Units</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {loading && runs.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-muted-foreground">
                    <Loader2 className="w-4 h-4 animate-spin inline-block mr-2" />
                    Loading runs…
                  </td>
                </tr>
              ) : runs.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-muted-foreground">
                    No runs yet. Onboard a target and trigger a scan.
                  </td>
                </tr>
              ) : (
                runs.map((run) => (
                  <tr
                    key={run.id}
                    onClick={() => openDrawer(run.id)}
                    className="cursor-pointer hover:bg-secondary/20 transition-colors"
                  >
                    <td className="px-6 py-4 font-mono text-[12px]">
                      <span className="inline-flex items-center gap-2">
                        <History className="w-3.5 h-3.5 text-muted-foreground" />
                        {run.id.slice(0, 8)}…
                      </span>
                    </td>
                    <td className="px-6 py-4 capitalize">{run.kind}</td>
                    <td className="px-6 py-4">
                      <StatusBadge status={run.status} />
                    </td>
                    <td className="px-6 py-4 max-w-[220px] truncate text-muted-foreground">
                      {run.target ?? "—"}
                    </td>
                    <td className="px-6 py-4 text-muted-foreground">
                      {formatTime(run.createdAt)}
                    </td>
                    <td className="px-6 py-4 text-muted-foreground">
                      {run.finishedAt ? formatTime(run.finishedAt) : "—"}
                    </td>
                    <td className="px-6 py-4 text-right font-mono text-[12px]">
                      {run.unitsBilled ?? "—"}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {focusedId && (
        <RunDetailDrawer id={focusedId} onClose={closeDrawer} onChanged={load} />
      )}
    </div>
  );
}

function RunDetailDrawer({
  id,
  onClose,
  onChanged,
}: {
  id: string;
  onClose: () => void;
  onChanged: () => Promise<void> | void;
}) {
  const [run, setRun] = useState<RunDetailDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [synthBusy, setSynthBusy] = useState(false);
  const [synthMsg, setSynthMsg] = useState<string | null>(null);

  const fetchRun = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/runs/${encodeURIComponent(id)}`, {
        cache: "no-store",
      });
      const body = await safeResponseJson<{
        ok?: boolean;
        data?: RunDetailDto;
        error?: { message?: string };
      }>(res);
      if (!res.ok || !body?.ok || !body.data) {
        setError(body?.error?.message ?? `Run not found (${res.status}).`);
        setRun(null);
        return;
      }
      setRun(body.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    void fetchRun();
  }, [fetchRun]);

  useEffect(() => {
    if (!run) return;
    if (run.status !== "queued" && run.status !== "running") return;
    const t = setInterval(() => {
      void fetchRun();
    }, POLL_MS);
    return () => clearInterval(t);
  }, [run, fetchRun]);

  async function handleSynthesize() {
    if (!run) return;
    setSynthBusy(true);
    setSynthMsg(null);
    try {
      const res = await fetch("/api/reports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ parentRunId: run.id }),
      });
      const body = await safeResponseJson<{
        ok?: boolean;
        data?: { runId?: string };
        error?: { message?: string };
      }>(res);
      if (!res.ok || !body?.ok) {
        setSynthMsg(body?.error?.message ?? `Failed (${res.status}).`);
        return;
      }
      setSynthMsg(
        `Report synthesis enqueued as run ${body.data?.runId?.slice(0, 8)}… — see the Reports page.`,
      );
      await onChanged();
    } catch (err) {
      setSynthMsg(err instanceof Error ? err.message : String(err));
    } finally {
      setSynthBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-40 flex justify-end">
      <div
        className="absolute inset-0 bg-background/60 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden
      />
      <aside className="relative h-full w-full max-w-xl bg-card border-l border-border shadow-2xl overflow-y-auto">
        <header className="sticky top-0 bg-card border-b border-border px-6 py-4 flex items-center justify-between z-10">
          <div className="min-w-0">
            <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground font-mono">
              Run detail
            </p>
            <h2 className="text-lg font-serif font-medium truncate">
              {run?.id ?? id}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary/50"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </header>

        <div className="p-6 space-y-6">
          {loading && !run ? (
            <p className="text-sm text-muted-foreground">
              <Loader2 className="w-4 h-4 animate-spin inline-block mr-2" />
              Loading…
            </p>
          ) : error ? (
            <div className="rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-[13px] text-destructive">
              {error}
            </div>
          ) : run ? (
            <>
              <section className="grid grid-cols-2 gap-4 text-[13px]">
                <Field label="Kind" value={run.kind} />
                <Field
                  label="Status"
                  value={<StatusBadge status={run.status} />}
                />
                <Field label="Target" value={run.target ?? "—"} mono />
                <Field label="Model" value={run.model ?? "—"} />
                <Field label="Created" value={formatTime(run.createdAt)} />
                <Field
                  label="Started"
                  value={run.startedAt ? formatTime(run.startedAt) : "—"}
                />
                <Field
                  label="Finished"
                  value={run.finishedAt ? formatTime(run.finishedAt) : "—"}
                />
                <Field
                  label="Units"
                  value={run.unitsBilled?.toString() ?? "—"}
                  mono
                />
              </section>

              {run.error && (
                <div className="rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-[13px] text-destructive break-words">
                  <strong className="font-semibold">Error:</strong> {run.error}
                </div>
              )}

              {run.kind === "scan" && run.status === "succeeded" && (
                <div className="rounded-xl border border-border bg-secondary/30 px-4 py-3 space-y-2">
                  <button
                    type="button"
                    onClick={() => void handleSynthesize()}
                    disabled={synthBusy}
                    className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-[13px] font-medium hover:bg-primary/90 disabled:opacity-50 flex items-center gap-2"
                  >
                    {synthBusy ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <FileText className="w-3.5 h-3.5" />
                    )}
                    Synthesize report from this run
                  </button>
                  {synthMsg && (
                    <p className="text-[12px] text-muted-foreground">{synthMsg}</p>
                  )}
                </div>
              )}

              <section>
                <h3 className="text-[12px] uppercase tracking-[0.18em] text-muted-foreground font-mono mb-3">
                  Trace ({run.trace?.length ?? 0})
                </h3>
                {run.trace?.length ? (
                  <ol className="space-y-2 text-[12px] font-mono">
                    {run.trace.map((event, idx) => (
                      <li
                        key={idx}
                        className="rounded-lg border border-border bg-background px-3 py-2"
                      >
                        <div className="flex items-center justify-between gap-2 text-muted-foreground">
                          <span>
                            {event.layer ?? "—"} · {event.agent ?? "—"} ·{" "}
                            {event.kind ?? "event"}
                          </span>
                          <span className="text-[10px]">
                            {event.ts
                              ? new Date(event.ts).toLocaleTimeString()
                              : ""}
                          </span>
                        </div>
                        {event.message && (
                          <div className="mt-1 text-foreground break-words">
                            {event.message}
                          </div>
                        )}
                        {event.meta && Object.keys(event.meta).length > 0 && (
                          <pre className="mt-1 text-[11px] text-muted-foreground bg-secondary/40 p-2 rounded overflow-x-auto">
                            {JSON.stringify(event.meta, null, 2)}
                          </pre>
                        )}
                      </li>
                    ))}
                  </ol>
                ) : (
                  <p className="text-[12px] text-muted-foreground">
                    No trace events recorded yet.
                  </p>
                )}
              </section>
            </>
          ) : null}
        </div>
      </aside>
    </div>
  );
}

function Field({
  label,
  value,
  mono,
}: {
  label: string;
  value: React.ReactNode;
  mono?: boolean;
}) {
  return (
    <div>
      <p className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground font-mono mb-1">
        {label}
      </p>
      <p
        className={cn(
          "text-[13px] text-foreground break-words",
          mono && "font-mono",
        )}
      >
        {value}
      </p>
    </div>
  );
}

function StatusBadge({ status }: { status: RunStatus }) {
  const map: Record<
    RunStatus,
    { label: string; cls: string; icon: React.ComponentType<{ className?: string }> }
  > = {
    queued: { label: "Queued", cls: "bg-muted text-muted-foreground border-border", icon: Clock },
    running: { label: "Running", cls: "bg-blue-500/10 text-blue-600 border-blue-500/20", icon: Loader2 },
    succeeded: { label: "Succeeded", cls: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20", icon: CheckCircle2 },
    failed: { label: "Failed", cls: "bg-destructive/10 text-destructive border-destructive/20", icon: XCircle },
    canceled: { label: "Canceled", cls: "bg-amber-500/10 text-amber-600 border-amber-500/20", icon: AlertCircle },
  };
  const { label, cls, icon: Icon } = map[status] ?? map.queued;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-medium border whitespace-nowrap",
        cls,
      )}
    >
      <Icon className={cn("w-3 h-3", status === "running" && "animate-spin")} />
      {label}
    </span>
  );
}

function formatTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString();
}
