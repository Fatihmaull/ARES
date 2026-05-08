"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  Activity,
  Code2,
  ExternalLink,
  Globe,
  Loader2,
  MoreVertical,
  Plus,
  RefreshCw,
  Search,
  ShieldCheck,
  Target as TargetIcon,
  Trash2,
  Wallet,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { safeResponseJson } from "@/lib/safe-response-json";
import {
  OnboardTargetDialog,
  type TargetKind,
} from "@/components/ares/onboard-target-dialog";

interface TargetDto {
  id: string;
  kind: TargetKind;
  identifier: string;
  label: string | null;
  createdAt: string;
  lastScannedAt: string | null;
  lastRunId: string | null;
  archivedAt: string | null;
}

const KIND_LABEL: Record<TargetKind, string> = {
  solana_program: "Solana program",
  evm_contract: "EVM contract",
  github_repo: "GitHub repo",
  domain: "Domain",
  wallet: "Wallet",
};

export default function TargetsPage() {
  const [targets, setTargets] = useState<TargetDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [openDialog, setOpenDialog] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [needsAuth, setNeedsAuth] = useState(false);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setActionError(null);
    try {
      const res = await fetch("/api/targets", { cache: "no-store" });
      if (res.status === 403) {
        setNeedsAuth(true);
        setTargets([]);
        return;
      }
      setNeedsAuth(false);
      const body = await safeResponseJson<{
        ok?: boolean;
        data?: { targets?: TargetDto[] };
      }>(res);
      setTargets(body?.data?.targets ?? []);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const filtered = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    if (!q) return targets;
    return targets.filter((t) => {
      return (
        t.identifier.toLowerCase().includes(q) ||
        (t.label?.toLowerCase().includes(q) ?? false) ||
        KIND_LABEL[t.kind].toLowerCase().includes(q)
      );
    });
  }, [targets, searchTerm]);

  async function handleScan(target: TargetDto) {
    setBusyId(target.id);
    setActionError(null);
    try {
      const res = await fetch(`/api/targets/${target.id}/scan`, {
        method: "POST",
      });
      const body = await safeResponseJson<{
        ok?: boolean;
        data?: { runId?: string };
        error?: { message?: string };
      }>(res);
      if (!res.ok || !body?.ok) {
        setActionError(body?.error?.message ?? `Scan failed (${res.status}).`);
        return;
      }
      await load();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusyId(null);
      setOpenMenuId(null);
    }
  }

  async function handleArchive(target: TargetDto) {
    setBusyId(target.id);
    setActionError(null);
    try {
      const res = await fetch(`/api/targets/${target.id}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const body = await safeResponseJson<{ error?: { message?: string } }>(res);
        setActionError(body?.error?.message ?? `Delete failed (${res.status}).`);
        return;
      }
      setTargets((prev) => prev.filter((t) => t.id !== target.id));
    } catch (err) {
      setActionError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusyId(null);
      setOpenMenuId(null);
    }
  }

  async function handleRename(target: TargetDto) {
    const next = window.prompt("New label", target.label ?? "");
    if (next === null) return;
    setBusyId(target.id);
    setActionError(null);
    try {
      const res = await fetch(`/api/targets/${target.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ label: next }),
      });
      const body = await safeResponseJson<{
        ok?: boolean;
        data?: { target?: TargetDto };
        error?: { message?: string };
      }>(res);
      if (!res.ok || !body?.ok || !body.data?.target) {
        setActionError(body?.error?.message ?? `Rename failed (${res.status}).`);
        return;
      }
      const updated = body.data.target;
      setTargets((prev) => prev.map((t) => (t.id === updated.id ? updated : t)));
    } catch (err) {
      setActionError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusyId(null);
      setOpenMenuId(null);
    }
  }

  return (
    <div className="space-y-12 animate-in fade-in slide-in-from-bottom-2 duration-700">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 overflow-hidden">
        <div>
          <p className="text-[12px] font-sans font-semibold text-primary uppercase tracking-[0.2em] mb-3">
            Monitor. Protect. Control.
          </p>
          <h1 className="text-5xl font-serif font-medium tracking-tight text-foreground mb-4">
            Inventory
          </h1>
          <p className="text-lg text-muted-foreground max-w-2xl leading-relaxed">
            A registry of monitored on-chain and off-chain assets. Onboard a
            target, then trigger a scan to enqueue an analysis run.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setOpenDialog(true)}
          className="flex items-center gap-2 px-5 py-2.5 bg-primary rounded-xl text-[14px] font-medium text-primary-foreground hover:bg-primary/90 transition-all shadow-xl shadow-primary/20 shrink-0"
        >
          <Plus className="w-4 h-4" />
          Onboard Asset
        </button>
      </div>

      {needsAuth && (
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-5 py-4 text-[14px] text-amber-700 dark:text-amber-300">
          Connect wallet and sign to start a session, then manage targets.
        </div>
      )}

      {actionError && (
        <div className="rounded-xl border border-destructive/30 bg-destructive/10 px-5 py-4 text-[14px] text-destructive">
          {actionError}
        </div>
      )}

      <div className="flex items-center gap-4">
        <div className="flex-1 flex items-center gap-3 px-4 py-2 bg-secondary/30 border border-border rounded-xl text-muted-foreground focus-within:ring-1 focus-within:ring-primary/30 transition-all group">
          <Search className="w-4 h-4 group-focus-within:text-foreground transition-colors" />
          <input
            type="text"
            placeholder="Search by identifier, label, or kind…"
            className="bg-transparent border-none text-[15px] w-full focus:ring-0 text-foreground placeholder:text-muted-foreground/60"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <button
          type="button"
          onClick={() => void load()}
          className="flex items-center gap-2 px-4 py-2 bg-secondary text-secondary-foreground border border-border rounded-xl text-[14px] font-medium hover:bg-muted transition-all"
        >
          <RefreshCw className={cn("w-4 h-4", loading && "animate-spin")} />
          Refresh
        </button>
      </div>

      <div className="ares-card whisper-shadow overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-[15px]">
            <thead>
              <tr className="border-b border-border bg-secondary/20">
                <th className="px-8 py-5 font-serif font-medium text-foreground">
                  Asset Identity
                </th>
                <th className="px-8 py-5 font-serif font-medium text-foreground">
                  Kind
                </th>
                <th className="px-8 py-5 font-serif font-medium text-foreground">
                  Last scan
                </th>
                <th className="px-8 py-5 font-serif font-medium text-foreground">
                  Last run
                </th>
                <th className="px-8 py-5 font-serif font-medium text-foreground text-right italic opacity-60">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {loading && filtered.length === 0 ? (
                <tr>
                  <td
                    colSpan={5}
                    className="px-8 py-12 text-center text-muted-foreground"
                  >
                    <Loader2 className="w-4 h-4 animate-spin inline-block mr-2" />
                    Loading targets…
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td
                    colSpan={5}
                    className="px-8 py-12 text-center text-muted-foreground"
                  >
                    No targets yet. Click <strong>Onboard Asset</strong> to add one.
                  </td>
                </tr>
              ) : (
                filtered.map((target) => (
                  <tr
                    key={target.id}
                    className="group hover:bg-secondary/10 transition-colors"
                  >
                    <td className="px-8 py-6">
                      <div className="flex items-center gap-4">
                        <div className="p-2.5 rounded-xl bg-card border border-border group-hover:border-primary/20 transition-all shadow-sm">
                          <KindIcon kind={target.kind} />
                        </div>
                        <div className="min-w-0">
                          <span className="font-serif font-medium text-lg block leading-tight truncate">
                            {target.label || target.identifier}
                          </span>
                          <span className="text-[11px] font-mono text-muted-foreground uppercase opacity-60 block truncate max-w-[260px]">
                            {target.identifier}
                          </span>
                        </div>
                      </div>
                    </td>
                    <td className="px-8 py-6 text-muted-foreground">
                      {KIND_LABEL[target.kind]}
                    </td>
                    <td className="px-8 py-6 text-muted-foreground">
                      {target.lastScannedAt
                        ? formatRelative(target.lastScannedAt)
                        : "Never"}
                    </td>
                    <td className="px-8 py-6">
                      {target.lastRunId ? (
                        <Link
                          href={`/dashboard/runs?run=${encodeURIComponent(target.lastRunId)}`}
                          className="inline-flex items-center gap-1.5 text-primary hover:text-primary/80 text-[13px] font-mono"
                        >
                          {target.lastRunId.slice(0, 8)}…
                          <ExternalLink className="w-3 h-3" />
                        </Link>
                      ) : (
                        <span className="text-muted-foreground/60 text-[13px]">
                          —
                        </span>
                      )}
                    </td>
                    <td className="px-8 py-6 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => void handleScan(target)}
                          disabled={busyId === target.id}
                          className="px-3 py-1.5 text-[12px] font-medium rounded-lg border border-border bg-secondary/40 hover:bg-secondary text-foreground disabled:opacity-50 flex items-center gap-1.5"
                        >
                          {busyId === target.id ? (
                            <Loader2 className="w-3 h-3 animate-spin" />
                          ) : (
                            <Activity className="w-3 h-3" />
                          )}
                          Re-scan
                        </button>
                        <div className="relative">
                          <button
                            type="button"
                            onClick={() =>
                              setOpenMenuId((prev) =>
                                prev === target.id ? null : target.id,
                              )
                            }
                            className="p-2 text-muted-foreground hover:text-foreground transition-colors border border-transparent hover:border-border rounded-lg"
                            aria-label="More actions"
                          >
                            <MoreVertical className="w-4 h-4" />
                          </button>
                          {openMenuId === target.id && (
                            <div className="absolute right-0 top-full mt-1 w-44 rounded-lg border border-border bg-card shadow-xl z-20">
                              <button
                                type="button"
                                onClick={() => void handleRename(target)}
                                className="w-full text-left px-3 py-2 text-[13px] hover:bg-secondary/50"
                              >
                                Rename label
                              </button>
                              <button
                                type="button"
                                onClick={() => void handleArchive(target)}
                                className="w-full text-left px-3 py-2 text-[13px] text-destructive hover:bg-destructive/10 flex items-center gap-1.5"
                              >
                                <Trash2 className="w-3 h-3" />
                                Delete
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <OnboardTargetDialog
        open={openDialog}
        onClose={() => setOpenDialog(false)}
        onCreated={() => void load()}
      />
    </div>
  );
}

function KindIcon({ kind }: { kind: TargetKind }) {
  switch (kind) {
    case "wallet":
      return <Wallet className="w-4 h-4 text-primary" />;
    case "evm_contract":
      return <ShieldCheck className="w-4 h-4 text-emerald-500" />;
    case "solana_program":
      return <ShieldCheck className="w-4 h-4 text-violet-500" />;
    case "github_repo":
      return <Code2 className="w-4 h-4 text-muted-foreground" />;
    case "domain":
      return <Globe className="w-4 h-4 text-blue-500" />;
    default:
      return <TargetIcon className="w-4 h-4 text-muted-foreground" />;
  }
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
