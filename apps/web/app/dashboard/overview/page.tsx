"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  ExternalLink,
  FileText,
  Loader2,
  Play,
  Shield,
  ShieldCheck,
  Target as TargetIcon,
  Zap,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { safeResponseJson } from "@/lib/safe-response-json";
import { NewScanDialog } from "@/components/ares/new-scan-dialog";

interface OverviewStatsDto {
  walletScoped: boolean;
  findingsOpenBySeverity: {
    critical: number;
    high: number;
    medium: number;
    low: number;
    informational: number;
  };
  findingsOpenTotal: number;
  runsLast7d: number;
  creditsBurnedLast7d: number;
  lastSuccessfulScanAt: string | null;
  generatedAt: string;
}

interface FindingDto {
  id: string;
  source: string;
  severity: string;
  rule: string;
  message: string;
  runId: string;
  createdAt: string;
}

export default function OverviewPage() {
  const [stats, setStats] = useState<OverviewStatsDto | null>(null);
  const [recent, setRecent] = useState<FindingDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [openScan, setOpenScan] = useState(false);
  const [recentlyEnqueued, setRecentlyEnqueued] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [statsRes, findingsRes] = await Promise.all([
        fetch("/api/analytics/overview", { cache: "no-store" }),
        fetch("/api/findings?limit=5", { cache: "no-store" }),
      ]);
      const statsBody = await safeResponseJson<{
        ok?: boolean;
        data?: OverviewStatsDto;
        error?: { message?: string };
      }>(statsRes);
      const findingsBody = await safeResponseJson<{
        ok?: boolean;
        data?: { findings?: FindingDto[] };
      }>(findingsRes);

      if (statsRes.ok && statsBody?.ok && statsBody.data) {
        setStats(statsBody.data);
      } else if (statsRes.status === 503) {
        setError("Database is not configured.");
      } else {
        setError(statsBody?.error?.message ?? `Stats failed (${statsRes.status}).`);
      }

      setRecent(findingsBody?.data?.findings?.slice(0, 5) ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const fmt = (n: number) => n.toString().padStart(2, "0");
  const totalCritHigh =
    (stats?.findingsOpenBySeverity?.critical ?? 0) +
    (stats?.findingsOpenBySeverity?.high ?? 0);

  return (
    <div className="space-y-12 animate-in fade-in slide-in-from-bottom-2 duration-700">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 overflow-hidden">
        <div className="max-w-2xl">
          <p className="text-[12px] font-sans font-semibold text-primary uppercase tracking-[0.2em] mb-3">
            Build for the frontier
          </p>
          <h1 className="text-5xl md:text-6xl font-serif font-medium leading-tight text-foreground mb-4">
            Security Command
          </h1>
          <p className="text-lg text-muted-foreground font-sans leading-relaxed">
            Centralized monitoring and autonomous detection for your on-chain
            assets. Calm, precise, operator-focused.
          </p>
        </div>
        <div className="flex gap-3 shrink-0">
          <Link
            href="/dashboard/reports"
            className="px-5 py-2.5 bg-secondary text-secondary-foreground rounded-xl text-[14px] font-medium hover:bg-muted transition-all flex items-center gap-2"
          >
            <FileText className="w-4 h-4" />
            Reports
          </Link>
          <button
            type="button"
            onClick={() => setOpenScan(true)}
            className="px-5 py-2.5 bg-primary text-primary-foreground rounded-xl text-[14px] font-medium hover:opacity-90 transition-all shadow-xl shadow-primary/20 flex items-center gap-2"
          >
            <Play className="w-4 h-4" />
            New scan
          </button>
        </div>
      </div>

      {error && (
        <div className="rounded-xl border border-destructive/30 bg-destructive/10 px-5 py-4 text-[14px] text-destructive">
          {error}
        </div>
      )}

      {recentlyEnqueued && (
        <div className="rounded-xl border border-primary/30 bg-primary/10 px-5 py-4 text-[14px] flex items-center gap-3">
          <CheckCircle2 className="w-4 h-4 text-primary" />
          Scan enqueued as run{" "}
          <Link
            href={`/dashboard/runs?run=${encodeURIComponent(recentlyEnqueued)}`}
            className="underline font-mono"
          >
            {recentlyEnqueued.slice(0, 8)}…
          </Link>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="Open critical+high"
          value={loading ? "…" : fmt(totalCritHigh)}
          trend={
            stats
              ? `${fmt(stats.findingsOpenBySeverity.critical)} critical · ${fmt(stats.findingsOpenBySeverity.high)} high`
              : ""
          }
          icon={<AlertTriangle className="w-5 h-5" />}
          isAlert={totalCritHigh > 0}
        />
        <StatCard
          label="Open findings (all)"
          value={loading ? "…" : fmt(stats?.findingsOpenTotal ?? 0)}
          trend="Across all severities"
          icon={<Shield className="w-5 h-5" />}
        />
        <StatCard
          label="Scan runs (7d)"
          value={loading ? "…" : fmt(stats?.runsLast7d ?? 0)}
          trend={stats?.lastSuccessfulScanAt ? `Last: ${formatRelative(stats.lastSuccessfulScanAt)}` : "No succeeded scans yet"}
          icon={<Activity className="w-5 h-5" />}
        />
        <StatCard
          label="Units burned (7d)"
          value={loading ? "…" : fmt(stats?.creditsBurnedLast7d ?? 0)}
          trend="Settled debits"
          icon={<Zap className="w-5 h-5" />}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 ares-card p-8 whisper-shadow">
          <h3 className="text-xl font-serif flex items-center gap-2 mb-6">
            <TargetIcon className="w-5 h-5 text-primary" />
            Open severity mix
          </h3>
          <SeverityBars stats={stats} loading={loading} />
        </div>

        <div className="ares-card p-8 bg-secondary/30 flex flex-col">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-xl font-serif flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-primary" />
              Latest findings
            </h3>
            <Link
              href="/dashboard/detections"
              className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground hover:text-foreground"
            >
              View all
            </Link>
          </div>

          <div className="space-y-3 flex-1">
            {loading && recent.length === 0 ? (
              <p className="text-sm text-muted-foreground inline-flex items-center gap-2">
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                Loading…
              </p>
            ) : recent.length === 0 ? (
              <div className="flex-1 flex flex-col items-center justify-center text-center p-8 opacity-50 italic">
                <ShieldCheck className="w-12 h-12 mb-3" />
                <p className="text-sm">
                  No findings yet — onboard a target and start a scan.
                </p>
              </div>
            ) : (
              recent.map((f) => (
                <Link
                  key={f.id}
                  href={`/dashboard/runs?run=${encodeURIComponent(f.runId)}`}
                  className="block p-4 rounded-xl bg-card border border-border hover:border-primary/30 transition-all"
                >
                  <div className="flex items-center gap-3">
                    <div
                      className={cn(
                        "w-2 h-2 rounded-full shrink-0",
                        f.severity === "Critical"
                          ? "bg-destructive"
                          : f.severity === "High"
                            ? "bg-primary"
                            : "bg-muted-foreground/40",
                      )}
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-[14px] font-semibold truncate">{f.rule}</p>
                      <p className="text-[12px] text-muted-foreground truncate">
                        {f.message}
                      </p>
                    </div>
                    <ExternalLink className="w-3.5 h-3.5 text-muted-foreground" />
                  </div>
                </Link>
              ))
            )}
          </div>
        </div>
      </div>

      <NewScanDialog
        open={openScan}
        onClose={() => setOpenScan(false)}
        onEnqueued={({ runId }) => {
          setRecentlyEnqueued(runId);
          void load();
        }}
      />
    </div>
  );
}

function StatCard({
  label,
  value,
  trend,
  icon,
  isAlert,
}: {
  label: string;
  value: string;
  trend: string;
  icon: React.ReactNode;
  isAlert?: boolean;
}) {
  return (
    <div
      className={cn(
        "ares-card p-6 whisper-shadow group relative overflow-hidden",
        isAlert ? "border-destructive/30" : "",
      )}
    >
      <div className="flex items-center justify-between mb-6">
        <div
          className={cn(
            "w-10 h-10 rounded-xl flex items-center justify-center transition-colors shadow-sm",
            isAlert
              ? "bg-destructive/10 text-destructive"
              : "bg-secondary text-primary group-hover:bg-primary group-hover:text-primary-foreground",
          )}
        >
          {icon}
        </div>
      </div>
      <div>
        <p className="text-[13px] font-medium text-muted-foreground mb-1 font-sans">
          {label}
        </p>
        <p className="text-4xl font-serif font-medium">{value}</p>
        {trend && (
          <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground/80 mt-2 font-mono">
            {trend}
          </p>
        )}
      </div>
    </div>
  );
}

function SeverityBars({
  stats,
  loading,
}: {
  stats: OverviewStatsDto | null;
  loading: boolean;
}) {
  if (loading || !stats) {
    return (
      <p className="text-sm text-muted-foreground inline-flex items-center gap-2">
        <Loader2 className="w-3.5 h-3.5 animate-spin" />
        Loading…
      </p>
    );
  }

  const items: { key: string; label: string; value: number; cls: string }[] = [
    {
      key: "critical",
      label: "Critical",
      value: stats.findingsOpenBySeverity.critical,
      cls: "bg-destructive",
    },
    {
      key: "high",
      label: "High",
      value: stats.findingsOpenBySeverity.high,
      cls: "bg-primary",
    },
    {
      key: "medium",
      label: "Medium",
      value: stats.findingsOpenBySeverity.medium,
      cls: "bg-amber-500",
    },
    {
      key: "low",
      label: "Low",
      value: stats.findingsOpenBySeverity.low,
      cls: "bg-blue-500",
    },
    {
      key: "info",
      label: "Informational",
      value: stats.findingsOpenBySeverity.informational,
      cls: "bg-muted-foreground/40",
    },
  ];
  const max = Math.max(1, ...items.map((i) => i.value));

  return (
    <div className="space-y-3">
      {items.map((it) => {
        const pct = (it.value / max) * 100;
        return (
          <div key={it.key} className="space-y-1">
            <div className="flex items-center justify-between text-[12px]">
              <span className="text-muted-foreground uppercase tracking-[0.15em]">
                {it.label}
              </span>
              <span className="font-mono">{it.value}</span>
            </div>
            <div className="h-2 rounded-full bg-secondary/50 overflow-hidden">
              <div
                className={cn("h-full transition-all duration-700", it.cls)}
                style={{ width: `${pct}%` }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}

function formatRelative(iso: string): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "—";
  const diffMs = Date.now() - then;
  const sec = Math.floor(diffMs / 1000);
  if (sec < 60) return `${sec}s ago`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const days = Math.floor(hr / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(iso).toLocaleDateString();
}
