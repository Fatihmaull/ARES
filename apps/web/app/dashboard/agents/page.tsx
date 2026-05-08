"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Activity,
  AlertCircle,
  CheckCircle2,
  Cpu,
  History,
  Loader2,
  Plus,
  RefreshCw,
  Search,
  Shield,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { safeResponseJson } from "@/lib/safe-response-json";

interface AgentDto {
  id: string;
  name: string;
  type: string;
  status: string;
  currentTask: string;
  model: string;
}

interface RunDto {
  id: string;
  kind: string;
  status: "queued" | "running" | "succeeded" | "failed" | "canceled";
  createdAt: string;
  finishedAt: string | null;
}

type CustomAgent = {
  id: string;
  name: string;
  skillsetIds: string[]; // maps to AgentDto.id entries
  createdAt: string;
};

function loadCustomAgents(): CustomAgent[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem("asst.customAgents.v1");
    if (!raw) return [];
    const parsed = JSON.parse(raw) as CustomAgent[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveCustomAgents(list: CustomAgent[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem("asst.customAgents.v1", JSON.stringify(list));
}

export default function AgentsPage() {
  const [agents, setAgents] = useState<AgentDto[]>([]);
  const [runs, setRuns] = useState<RunDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [customAgents, setCustomAgents] = useState<CustomAgent[]>([]);
  const [builderName, setBuilderName] = useState("");
  const [builderSelected, setBuilderSelected] = useState<Set<string>>(new Set());

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [agentsRes, runsRes] = await Promise.all([
        fetch("/api/agents", { cache: "no-store" }),
        fetch("/api/runs?limit=200", { cache: "no-store" }),
      ]);
      const agentsBody = await safeResponseJson<{
        ok?: boolean;
        data?: { agents?: AgentDto[] };
        error?: { message?: string };
      }>(agentsRes);
      if (agentsRes.ok && agentsBody?.ok) {
        setAgents(agentsBody.data?.agents ?? []);
      } else {
        setError(
          agentsBody?.error?.message ??
            `Agents request failed (${agentsRes.status}).`,
        );
      }

      const runsBody = await safeResponseJson<{
        ok?: boolean;
        data?: { runs?: RunDto[] };
      }>(runsRes);
      if (runsRes.ok && runsBody?.ok) {
        setRuns(runsBody.data?.runs ?? []);
      }
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
    setCustomAgents(loadCustomAgents());
  }, []);

  const fleetStats = useMemo(() => {
    const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
    let total = 0;
    let succeeded = 0;
    let failed = 0;
    let inflight = 0;
    let lastRunIso: string | null = null;
    for (const r of runs) {
      const ts = new Date(r.createdAt).getTime();
      if (Number.isNaN(ts) || ts < sevenDaysAgo) continue;
      total += 1;
      if (r.status === "succeeded") succeeded += 1;
      else if (r.status === "failed") failed += 1;
      else if (r.status === "queued" || r.status === "running") inflight += 1;
      if (!lastRunIso || ts > new Date(lastRunIso).getTime()) {
        lastRunIso = r.createdAt;
      }
    }
    return { total, succeeded, failed, inflight, lastRunIso };
  }, [runs]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return agents;
    return agents.filter((a) =>
      [a.name, a.type, a.currentTask, a.model].some((field) =>
        field?.toLowerCase().includes(q),
      ),
    );
  }, [agents, search]);

  const skillsets = useMemo(() => {
    // Interpret each shipped sub-agent entry as a skillset building block.
    return agents.map((a) => ({
      id: a.id,
      label: a.name,
      desc: a.currentTask,
      type: a.type,
      model: a.model,
    }));
  }, [agents]);

  const defaultGroups = useMemo(() => {
    function pick(...preds: Array<(a: AgentDto) => boolean>) {
      return agents.filter((a) => preds.some((p) => p(a)));
    }
    const solana = pick((a) => a.name.toLowerCase().includes("solana"));
    const defi = pick(
      (a) => a.name.toLowerCase().includes("defi"),
      (a) => a.name.toLowerCase().includes("flash"),
      (a) => a.name.toLowerCase().includes("oracle"),
    );
    const rugsMev = pick(
      (a) => a.name.toLowerCase().includes("rug"),
      (a) => a.name.toLowerCase().includes("mev"),
      (a) => a.name.toLowerCase().includes("sandwich"),
    );
    const ops = pick(
      (a) => a.name.toLowerCase().includes("secret"),
      (a) => a.name.toLowerCase().includes("supply"),
      (a) => a.name.toLowerCase().includes("hygiene"),
      (a) => a.name.toLowerCase().includes("compliance"),
      (a) => a.name.toLowerCase().includes("screen"),
      (a) => a.name.toLowerCase().includes("risk"),
      (a) => a.name.toLowerCase().includes("osint"),
    );

    const seen = new Set<string>();
    const rest = agents.filter((a) => {
      if (solana.includes(a) || defi.includes(a) || rugsMev.includes(a) || ops.includes(a)) {
        return false;
      }
      if (seen.has(a.id)) return false;
      return true;
    });
    return [
      { title: "Solana security", items: solana },
      { title: "DeFi & protocol audit", items: defi },
      { title: "Rug & MEV investigations", items: rugsMev },
      { title: "Ops, hygiene & compliance", items: ops },
      { title: "Other skillsets", items: rest },
    ].filter((g) => g.items.length > 0);
  }, [agents]);

  function toggleSelected(id: string) {
    setBuilderSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function createCustomAgent() {
    const name = builderName.trim();
    const ids = Array.from(builderSelected);
    if (!name || ids.length === 0) return;
    const next: CustomAgent = {
      id: `ca-${crypto.randomUUID()}`,
      name,
      skillsetIds: ids,
      createdAt: new Date().toISOString(),
    };
    const merged = [next, ...customAgents];
    setCustomAgents(merged);
    saveCustomAgents(merged);
    setBuilderName("");
    setBuilderSelected(new Set());
  }

  return (
    <div className="space-y-12 animate-in fade-in slide-in-from-bottom-2 duration-700">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 overflow-hidden">
        <div>
          <p className="text-[12px] font-sans font-semibold text-primary uppercase tracking-[0.2em] mb-3">
            Distributed Intelligence
          </p>
          <h1 className="text-5xl font-serif font-medium tracking-tight text-foreground mb-4">
            Autonomous Systems
          </h1>
          <p className="text-lg text-muted-foreground max-w-2xl leading-relaxed">
            Read-only catalog of sub-agents shipped with this build. Activity
            stats are aggregated from your recent runs.
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

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <FleetStat
          label="Runs (7d)"
          value={fleetStats.total}
          icon={<Activity className="w-5 h-5" />}
        />
        <FleetStat
          label="Succeeded"
          value={fleetStats.succeeded}
          icon={<CheckCircle2 className="w-5 h-5" />}
          tone="emerald"
        />
        <FleetStat
          label="Failed"
          value={fleetStats.failed}
          icon={<AlertCircle className="w-5 h-5" />}
          tone="destructive"
        />
        <FleetStat
          label="In-flight"
          value={fleetStats.inflight}
          icon={<Loader2 className={cn("w-5 h-5", fleetStats.inflight > 0 && "animate-spin")} />}
          tone="primary"
        />
      </div>

      <div className="flex items-center gap-4">
        <div className="flex-1 flex items-center gap-3 px-4 py-2 bg-secondary/30 border border-border rounded-xl text-muted-foreground focus-within:ring-1 focus-within:ring-primary/30 transition-all group">
          <Search className="w-4 h-4 group-focus-within:text-foreground transition-colors" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name, type, task, or model…"
            className="bg-transparent border-none text-[15px] w-full focus:ring-0 text-foreground placeholder:text-muted-foreground/60"
          />
        </div>
      </div>

      {/* Default agents (grouped from skillsets) */}
      <div className="space-y-10">
        {defaultGroups.map((g) => (
          <section key={g.title} className="space-y-4">
            <div className="flex items-baseline justify-between">
              <h2 className="text-2xl font-serif font-medium">{g.title}</h2>
              <span className="text-[11px] font-mono uppercase tracking-[0.18em] text-muted-foreground">
                {g.items.length} skillset(s)
              </span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              {(loading && filtered.length === 0 ? [] : g.items).map((agent) => (
                <SkillsetCard
                  key={agent.id}
                  agent={agent}
                  footer={
                    fleetStats.lastRunIso
                      ? `Last fleet run ${formatRelative(fleetStats.lastRunIso)}`
                      : "No recent runs"
                  }
                />
              ))}
              {loading && filtered.length === 0
                ? [1, 2, 3].map((i) => (
                    <div
                      key={`${g.title}-${i}`}
                      className="ares-card p-12 flex items-center justify-center bg-secondary/10 border border-border border-dashed animate-pulse"
                    >
                      <Activity className="w-8 h-8 text-muted-foreground/20" />
                    </div>
                  ))
                : null}
            </div>
          </section>
        ))}
      </div>

      {/* Custom agent builder (UI-only, persisted locally) */}
      <section className="ares-card whisper-shadow p-8 bg-secondary/10 border border-border">
        <div className="flex items-start justify-between gap-6 flex-wrap">
          <div>
            <h2 className="text-2xl font-serif font-medium">Build a custom agent</h2>
            <p className="text-sm text-muted-foreground mt-2 max-w-2xl">
              Coming soon: create agents that run long tasks from the console. For now this is a UI preview
              (saved locally in your browser) showing how skillsets can be composed.
            </p>
          </div>
          <button
            type="button"
            onClick={createCustomAgent}
            disabled={!builderName.trim() || builderSelected.size === 0}
            className="px-5 py-2.5 bg-primary text-primary-foreground rounded-xl text-[14px] font-medium hover:opacity-90 transition-all shadow-xl shadow-primary/20 disabled:opacity-50 flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            Create agent (preview)
          </button>
        </div>

        <div className="mt-6 grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-1 space-y-3">
            <label className="text-[12px] font-semibold uppercase tracking-[0.18em] text-muted-foreground block">
              Agent name
            </label>
            <input
              value={builderName}
              onChange={(e) => setBuilderName(e.target.value)}
              placeholder="e.g. Running test A"
              className="w-full px-3 py-2 rounded-lg bg-background border border-border text-[14px]"
            />
            <p className="text-[12px] text-muted-foreground">
              Pick skillsets on the right, then create.
            </p>
          </div>

          <div className="lg:col-span-2 space-y-3">
            <div className="flex items-baseline justify-between">
              <p className="text-[12px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                Skillsets
              </p>
              <p className="text-[11px] font-mono uppercase tracking-[0.18em] text-muted-foreground">
                selected: {builderSelected.size}
              </p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {skillsets.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => toggleSelected(s.id)}
                  className={cn(
                    "text-left rounded-xl border px-4 py-3 transition-colors",
                    builderSelected.has(s.id)
                      ? "border-primary/40 bg-primary/10"
                      : "border-border bg-card hover:bg-secondary/30",
                  )}
                >
                  <p className="text-[13px] font-medium text-foreground">{s.label}</p>
                  <p className="text-[12px] text-muted-foreground mt-1 line-clamp-2">
                    {s.desc}
                  </p>
                </button>
              ))}
            </div>
          </div>
        </div>

        {customAgents.length > 0 && (
          <div className="mt-8">
            <h3 className="text-[12px] font-semibold uppercase tracking-[0.18em] text-muted-foreground mb-3">
              Saved custom agents (local preview)
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {customAgents.map((ca) => (
                <div key={ca.id} className="rounded-xl border border-border bg-card p-4">
                  <p className="text-[14px] font-medium text-foreground">{ca.name}</p>
                  <p className="text-[12px] text-muted-foreground mt-1">
                    {ca.skillsetIds.length} skillset(s) · created {formatRelative(ca.createdAt)}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}
      </section>
    </div>
  );
}

function FleetStat({
  label,
  value,
  icon,
  tone,
}: {
  label: string;
  value: number;
  icon: React.ReactNode;
  tone?: "emerald" | "destructive" | "primary";
}) {
  const cls =
    tone === "emerald"
      ? "bg-emerald-500/10 text-emerald-600"
      : tone === "destructive"
        ? "bg-destructive/10 text-destructive"
        : tone === "primary"
          ? "bg-primary/10 text-primary"
          : "bg-secondary text-muted-foreground";
  return (
    <div className="ares-card p-4 bg-secondary/20 flex items-center gap-4 border border-border">
      <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center", cls)}>
        {icon}
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

function SkillsetCard({ agent, footer }: { agent: AgentDto; footer: string }) {
  return (
    <article className="ares-card whisper-shadow group hover:ring-shadow transition-all flex flex-col h-full bg-secondary/10 hover:bg-card border border-border">
      <div className="p-8 space-y-6 flex-1">
        <div className="flex items-start justify-between">
          <div className="w-12 h-12 rounded-2xl bg-secondary flex items-center justify-center border border-border group-hover:border-primary/20 transition-all shadow-sm">
            {agent.type === "protocol_auditor" ? (
              <Shield className="w-6 h-6 text-primary" />
            ) : (
              <Cpu className="w-6 h-6 text-primary" />
            )}
          </div>
          <span className="px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest border bg-emerald-500/10 text-emerald-600 border-emerald-500/10">
            Available
          </span>
        </div>

        <div>
          <h3 className="text-2xl font-serif font-medium mb-1 leading-tight">
            {agent.name}
          </h3>
          <p className="text-xs font-mono text-muted-foreground uppercase tracking-tighter opacity-60">
            {agent.type}
          </p>
        </div>

        <div className="p-4 bg-secondary/50 rounded-xl border border-border/50">
          <p className="text-[11px] text-muted-foreground uppercase tracking-widest font-semibold mb-2">
            Description
          </p>
          <p className="text-[14px] font-sans text-foreground leading-snug">
            {agent.currentTask}
          </p>
        </div>

        <div>
          <p className="text-[10px] text-muted-foreground uppercase tracking-widest font-semibold mb-1">
            Engine
          </p>
          <p
            className="text-[13px] font-mono text-foreground truncate"
            title={agent.model}
          >
            {agent.model}
          </p>
        </div>
      </div>

      <div className="px-8 py-5 border-t border-border bg-secondary/20 flex items-center justify-between text-[12px] text-muted-foreground">
        <span className="inline-flex items-center gap-1.5">
          <History className="w-3.5 h-3.5" />
          {footer}
        </span>
      </div>
    </article>
  );
}
