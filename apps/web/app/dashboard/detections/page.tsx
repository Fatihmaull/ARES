"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  ExternalLink,
  Filter,
  Loader2,
  Search,
  ShieldAlert,
  ShieldCheck,
  Target as TargetIcon,
  User,
  XCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { safeResponseJson } from "@/lib/safe-response-json";

type Severity = "Critical" | "High" | "Medium" | "Low" | "Informational";
type WorkflowStatus = "open" | "acknowledged" | "resolved" | "wont_fix";

interface FindingDto {
  id: string;
  source: string;
  severity: Severity | string;
  rule: string;
  message: string;
  location: string | null;
  line: number;
  runId: string;
  createdAt: string;
  status: WorkflowStatus | string;
  notes: string | null;
  resolvedAt: string | null;
}

interface FindingsApiResponse {
  source: string;
  total: number;
  bySeverity: { critical: number; high: number; medium: number; low: number };
  findings: FindingDto[];
  generatedAt: string;
}

const SEVERITY_OPTIONS: ("All" | Severity)[] = [
  "All",
  "Critical",
  "High",
  "Medium",
  "Low",
  "Informational",
];

const STATUS_OPTIONS: ("All" | WorkflowStatus)[] = [
  "All",
  "open",
  "acknowledged",
  "resolved",
  "wont_fix",
];

const STATUS_LABEL: Record<WorkflowStatus, string> = {
  open: "Open",
  acknowledged: "Acknowledged",
  resolved: "Resolved",
  wont_fix: "Won't fix",
};

export default function DetectionsPage() {
  const [findings, setFindings] = useState<FindingDto[]>([]);
  const [stats, setStats] = useState<FindingsApiResponse["bySeverity"]>({
    critical: 0,
    high: 0,
    medium: 0,
    low: 0,
  });
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const [search, setSearch] = useState("");
  const [severity, setSeverity] = useState<"All" | Severity>("All");
  const [status, setStatus] = useState<"All" | WorkflowStatus>("All");
  const [source, setSource] = useState<"All" | string>("All");

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/findings?limit=200", { cache: "no-store" });
      const body = await safeResponseJson<{
        ok?: boolean;
        data?: FindingsApiResponse;
        error?: { message?: string };
      }>(res);
      if (!res.ok || !body?.ok || !body.data) {
        setError(body?.error?.message ?? `Request failed (${res.status}).`);
        setFindings([]);
        return;
      }
      setFindings(body.data.findings ?? []);
      setStats(
        body.data.bySeverity ?? { critical: 0, high: 0, medium: 0, low: 0 },
      );
      setTotal(body.data.total ?? 0);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const sources = useMemo(() => {
    const set = new Set<string>();
    for (const f of findings) {
      if (f.source) set.add(f.source);
    }
    return Array.from(set).sort();
  }, [findings]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return findings.filter((f) => {
      if (severity !== "All" && (f.severity ?? "").toString() !== severity) {
        return false;
      }
      if (status !== "All" && (f.status ?? "open") !== status) {
        return false;
      }
      if (source !== "All" && f.source !== source) {
        return false;
      }
      if (!q) return true;
      const hay = [
        f.rule,
        f.message,
        f.location ?? "",
        f.source,
        f.severity?.toString() ?? "",
      ]
        .join(" ")
        .toLowerCase();
      return hay.includes(q);
    });
  }, [findings, severity, status, source, search]);

  async function patchStatus(
    id: string,
    next: WorkflowStatus,
    notes?: string | null,
  ) {
    setBusyId(id);
    try {
      const res = await fetch(`/api/findings/${encodeURIComponent(id)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: next, notes: notes ?? null }),
      });
      if (!res.ok) {
        const body = await safeResponseJson<{ error?: { message?: string } }>(
          res,
        );
        setError(body?.error?.message ?? `Update failed (${res.status}).`);
        return false;
      }
      setFindings((prev) =>
        prev.map((f) => (f.id === id ? { ...f, status: next } : f)),
      );
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      return false;
    } finally {
      setBusyId(null);
    }
  }

  async function handleDismissAllVisible() {
    if (!filtered.length) return;
    const onlyOpen = filtered.filter((f) => (f.status ?? "open") === "open");
    if (!onlyOpen.length) return;
    const ok = window.confirm(
      `Mark ${onlyOpen.length} visible open finding(s) as Won't fix?`,
    );
    if (!ok) return;
    for (const f of onlyOpen) {
      await patchStatus(f.id, "wont_fix");
    }
  }

  return (
    <div className="space-y-12 animate-in fade-in slide-in-from-bottom-2 duration-700">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div>
          <p className="text-[12px] font-sans font-semibold text-primary uppercase tracking-[0.2em] mb-3">
            Triage & Analysis
          </p>
          <h1 className="text-5xl font-serif font-medium tracking-tight text-foreground mb-4">
            Signal Intelligence
          </h1>
          <p className="text-lg text-muted-foreground max-w-2xl leading-relaxed">
            Findings emitted by scan and tool runs. Filter by severity, status,
            or source, then triage individually or bulk-dismiss.
          </p>
        </div>
        <div className="flex gap-3">
          <button
            type="button"
            onClick={() => void handleDismissAllVisible()}
            className="px-5 py-2.5 bg-secondary text-secondary-foreground rounded-xl text-[14px] font-medium hover:bg-muted transition-all flex items-center gap-2"
          >
            <CheckCircle2 className="w-4 h-4 text-emerald-500" />
            Dismiss visible open
          </button>
        </div>
      </div>

      {error && (
        <div className="rounded-xl border border-destructive/30 bg-destructive/10 px-5 py-4 text-[14px] text-destructive">
          {error}
        </div>
      )}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Stat label="Critical" value={stats.critical} tone="destructive" icon={ShieldAlert} />
        <Stat label="High" value={stats.high} tone="primary" icon={AlertTriangle} />
        <Stat label="Medium" value={stats.medium} tone="muted" icon={ShieldCheck} />
        <Stat label="Total" value={total} tone="muted" icon={CheckCircle2} />
      </div>

      <div className="flex flex-col md:flex-row md:items-center gap-3 pb-4 border-b border-border">
        <div className="flex-1 flex items-center gap-3 px-4 py-2 bg-secondary/30 rounded-xl border border-border focus-within:ring-1 focus-within:ring-primary/30 transition-all group">
          <Search className="w-4 h-4 text-muted-foreground group-focus-within:text-foreground transition-colors" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by rule, message, location, source…"
            className="bg-transparent border-none focus:ring-0 text-sm w-full placeholder:text-muted-foreground/60"
          />
        </div>
        <Select
          label="Severity"
          value={severity}
          onChange={(v) => setSeverity(v as "All" | Severity)}
          options={SEVERITY_OPTIONS}
        />
        <Select
          label="Status"
          value={status}
          onChange={(v) => setStatus(v as "All" | WorkflowStatus)}
          options={STATUS_OPTIONS}
          renderLabel={(v) =>
            v === "All" ? "All" : STATUS_LABEL[v as WorkflowStatus] ?? v
          }
        />
        <Select
          label="Source"
          value={source}
          onChange={setSource}
          options={["All", ...sources]}
        />
      </div>

      <div className="space-y-4">
        {loading && filtered.length === 0 ? (
          <div className="text-center text-muted-foreground py-12">
            <Loader2 className="w-4 h-4 animate-spin inline-block mr-2" />
            Loading findings…
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center opacity-60">
            <CheckCircle2 className="w-12 h-12 mb-3 text-emerald-500" />
            <h3 className="text-xl font-serif">Clear horizon</h3>
            <p className="max-w-md mt-2 text-sm">
              No findings match the current filters.
            </p>
          </div>
        ) : (
          filtered.map((f) => (
            <FindingRow
              key={f.id}
              finding={f}
              busy={busyId === f.id}
              onPatch={patchStatus}
            />
          ))
        )}
      </div>
    </div>
  );
}

function Stat({
  label,
  value,
  tone,
  icon: Icon,
}: {
  label: string;
  value: number;
  tone: "destructive" | "primary" | "muted";
  icon: React.ComponentType<{ className?: string }>;
}) {
  const cls =
    tone === "destructive"
      ? "bg-destructive/10 text-destructive"
      : tone === "primary"
        ? "bg-primary/10 text-primary"
        : "bg-muted text-muted-foreground";
  return (
    <div className="ares-card p-4 bg-secondary/20 flex items-center gap-4 border border-border">
      <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center", cls)}>
        <Icon className="w-5 h-5" />
      </div>
      <div>
        <p className="text-[11px] uppercase tracking-widest text-muted-foreground font-semibold">
          {label}
        </p>
        <p className="text-2xl font-serif font-medium">
          {value.toString().padStart(2, "0")}
        </p>
      </div>
    </div>
  );
}

function Select({
  label,
  value,
  onChange,
  options,
  renderLabel,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: readonly string[];
  renderLabel?: (v: string) => string;
}) {
  return (
    <label className="flex items-center gap-2 text-[13px] text-muted-foreground">
      <Filter className="w-3.5 h-3.5" />
      <span className="hidden md:inline">{label}:</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="bg-secondary/40 border border-border rounded-lg px-2 py-1.5 text-foreground"
      >
        {options.map((opt) => (
          <option key={opt} value={opt}>
            {renderLabel ? renderLabel(opt) : opt}
          </option>
        ))}
      </select>
    </label>
  );
}

function FindingRow({
  finding,
  busy,
  onPatch,
}: {
  finding: FindingDto;
  busy: boolean;
  onPatch: (id: string, status: WorkflowStatus) => Promise<boolean>;
}) {
  const sev = (finding.severity ?? "").toString();
  const status = (finding.status ?? "open") as WorkflowStatus;
  const tone =
    sev === "Critical"
      ? "bg-destructive shadow-lg shadow-destructive/20"
      : sev === "High"
        ? "bg-primary shadow-lg shadow-primary/20"
        : "bg-muted-foreground/30";

  return (
    <div className="ares-card overflow-hidden whisper-shadow group hover:ring-shadow transition-all border border-border">
      <div className="p-6 flex flex-col md:flex-row gap-6 md:items-center">
        <div className={cn("w-3 h-12 rounded-full shrink-0", tone)} />

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3 mb-2 flex-wrap">
            <h3 className="text-xl font-serif font-medium">{finding.rule}</h3>
            <span
              className={cn(
                "px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-widest border",
                sev === "Critical"
                  ? "bg-destructive/10 text-destructive border-destructive/20"
                  : sev === "High"
                    ? "bg-primary/10 text-primary border-primary/20"
                    : "bg-muted text-muted-foreground border-border",
              )}
            >
              {sev || "Info"}
            </span>
            <StatusPill status={status} />
          </div>

          <div className="flex flex-wrap items-center gap-y-2 gap-x-6 text-[13px] text-muted-foreground font-sans">
            {finding.location && (
              <div className="flex items-center gap-1.5 overflow-hidden max-w-[360px]">
                <TargetIcon className="w-3.5 h-3.5" />
                <span className="truncate">
                  {finding.location}
                  {finding.line ? `:${finding.line}` : ""}
                </span>
              </div>
            )}
            <div className="flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5" />
              {new Date(finding.createdAt).toLocaleString()}
            </div>
            <div className="flex items-center gap-1.5">
              <User className="w-3.5 h-3.5" />
              {finding.source || "ARES Engine"}
            </div>
          </div>
          <p className="mt-3 text-[14px] text-foreground leading-relaxed font-sans break-words">
            {finding.message}
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0 flex-wrap">
          <Link
            href={`/dashboard/runs?run=${encodeURIComponent(finding.runId)}`}
            className="px-4 py-2 bg-secondary text-foreground rounded-xl text-xs font-semibold hover:bg-muted transition-all uppercase tracking-widest inline-flex items-center gap-1.5"
          >
            Investigate
            <ExternalLink className="w-3 h-3" />
          </Link>
          <select
            value={status}
            disabled={busy}
            onChange={(e) =>
              void onPatch(finding.id, e.target.value as WorkflowStatus)
            }
            className="bg-secondary/40 border border-border rounded-lg px-2 py-2 text-[12px]"
            aria-label="Change status"
          >
            {(["open", "acknowledged", "resolved", "wont_fix"] as WorkflowStatus[]).map(
              (s) => (
                <option key={s} value={s}>
                  {STATUS_LABEL[s]}
                </option>
              ),
            )}
          </select>
          {busy && <Loader2 className="w-3.5 h-3.5 animate-spin text-muted-foreground" />}
        </div>
      </div>
    </div>
  );
}

function StatusPill({ status }: { status: WorkflowStatus }) {
  const cls: Record<WorkflowStatus, string> = {
    open: "bg-blue-500/10 text-blue-600 border-blue-500/20",
    acknowledged: "bg-amber-500/10 text-amber-600 border-amber-500/20",
    resolved: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20",
    wont_fix: "bg-muted text-muted-foreground border-border",
  };
  const Icon = status === "resolved" ? CheckCircle2 : status === "wont_fix" ? XCircle : AlertTriangle;
  return (
    <span
      className={cn(
        "px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-widest border inline-flex items-center gap-1",
        cls[status],
      )}
    >
      <Icon className="w-3 h-3" />
      {STATUS_LABEL[status]}
    </span>
  );
}
