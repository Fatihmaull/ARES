"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ExternalLink, Loader2, ShieldAlert } from "lucide-react";

import { cn } from "@/lib/utils";

type MeJson = {
  ok?: boolean;
  data?: {
    authenticated?: boolean;
    isAdmin?: boolean;
    wallet?: string;
  };
};

type WalletInspectJson = {
  ok?: boolean;
  data?: {
    wallet?: string;
    exists?: boolean;
    tier?: string | null;
    balanceUnits?: number;
    ledger?: {
      id: string;
      direction: string;
      units: number;
      reason: string;
      status: string;
      createdAt: string;
      relatedTxSig: string | null;
      relatedRunId: string | null;
    }[];
  };
  error?: { message?: string };
};

function solscanTxUrl(signature: string): string {
  const net = process.env.NEXT_PUBLIC_SOLANA_NETWORK?.trim();
  const cluster =
    net === "mainnet-beta" ? "" : `?cluster=${encodeURIComponent(net || "devnet")}`;
  return `https://solscan.io/tx/${signature}${cluster}`;
}

export default function AdminPage() {
  const [me, setMe] = useState<MeJson["data"] | null>(null);
  const [loadingMe, setLoadingMe] = useState(true);
  const [walletInput, setWalletInput] = useState("");
  const [inspect, setInspect] = useState<WalletInspectJson["data"] | null>(null);
  const [inspectLoading, setInspectLoading] = useState(false);
  const [inspectErr, setInspectErr] = useState<string | null>(null);

  const [adjWallet, setAdjWallet] = useState("");
  const [adjUnits, setAdjUnits] = useState("100");
  const [adjDir, setAdjDir] = useState<"CREDIT" | "DEBIT">("CREDIT");
  const [adjReason, setAdjReason] = useState("admin_adjust");
  const [adjBusy, setAdjBusy] = useState(false);
  const [adjMsg, setAdjMsg] = useState<string | null>(null);

  useEffect(() => {
    let c = false;
    (async () => {
      try {
        const r = await fetch("/api/auth/me", { credentials: "include" });
        const j = (await r.json()) as MeJson;
        if (!c) setMe(j.data ?? null);
      } finally {
        if (!c) setLoadingMe(false);
      }
    })();
    return () => {
      c = true;
    };
  }, []);

  const loadWallet = useCallback(async (addressOverride?: string) => {
    const addr = (addressOverride ?? walletInput).trim();
    if (!addr) {
      setInspectErr("Enter a wallet address.");
      return;
    }
    setInspectLoading(true);
    setInspectErr(null);
    try {
      const r = await fetch(
        `/api/admin/wallet/${encodeURIComponent(addr)}`,
        { credentials: "include" },
      );
      const j = (await r.json()) as WalletInspectJson;
      if (!j.ok) {
        setInspect(null);
        setInspectErr(j.error?.message || "Request failed");
        return;
      }
      setInspect(j.data ?? null);
    } catch (e) {
      setInspect(null);
      setInspectErr(e instanceof Error ? e.message : String(e));
    } finally {
      setInspectLoading(false);
    }
  }, [walletInput]);

  const submitAdjust = useCallback(async () => {
    setAdjBusy(true);
    setAdjMsg(null);
    try {
      const wallet = adjWallet.trim() || walletInput.trim();
      const units = Number.parseInt(adjUnits, 10);
      const r = await fetch("/api/admin/adjust", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          wallet,
          units,
          direction: adjDir,
          reason: adjReason.trim() || "admin_adjust",
        }),
      });
      const j = (await r.json()) as { ok?: boolean; error?: { message?: string } };
      if (!j.ok) {
        setAdjMsg(j.error?.message || "Adjust failed");
        return;
      }
      setAdjMsg("Ledger updated.");
      if (wallet) {
        setWalletInput(wallet);
        void loadWallet(wallet);
      }
    } catch (e) {
      setAdjMsg(e instanceof Error ? e.message : String(e));
    } finally {
      setAdjBusy(false);
    }
  }, [adjDir, adjReason, adjUnits, adjWallet, loadWallet, walletInput]);

  if (loadingMe) {
    return (
      <div className="flex items-center gap-2 text-muted-foreground">
        <Loader2 className="w-4 h-4 animate-spin" />
        Loading…
      </div>
    );
  }

  if (!me?.authenticated) {
    return (
      <div className="rounded-xl border border-border bg-card/60 p-6 max-w-lg">
        <h1 className="text-xl font-semibold">Admin</h1>
        <p className="text-sm text-muted-foreground mt-2">
          Sign in with a wallet in the header, then return here.
        </p>
        <Link href="/dashboard/overview" className="text-primary text-sm mt-4 inline-block hover:underline">
          Back to overview
        </Link>
      </div>
    );
  }

  if (!me.isAdmin) {
    return (
      <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-6 max-w-lg flex gap-3">
        <ShieldAlert className="w-6 h-6 text-amber-500 shrink-0" />
        <div>
          <h1 className="text-xl font-semibold">Admin access denied</h1>
          <p className="text-sm text-muted-foreground mt-2">
            Your wallet is not listed in <span className="font-mono text-xs">ASST_ADMIN_WALLETS</span>.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-10 max-w-4xl">
      <div>
        <span className="text-[11px] font-mono uppercase tracking-[0.2em] text-muted-foreground">
          Operations
        </span>
        <h1 className="text-3xl font-serif tracking-tight mt-1">Admin</h1>
        <p className="text-muted-foreground text-sm mt-2 max-w-[62ch]">
          Inspect wallet tier and ledger, or post manual credit/debit entries. Requires an admin
          session cookie.
        </p>
      </div>

      <section className="rounded-xl border border-border bg-card/80 p-6 flex flex-col gap-4">
        <h2 className="text-lg font-semibold">Inspect wallet</h2>
        <div className="flex flex-wrap gap-2">
          <input
            type="text"
            value={walletInput}
            onChange={(e) => setWalletInput(e.target.value)}
            placeholder="Base58 wallet address"
            className="flex-1 min-w-[200px] px-3 py-2 rounded-lg border border-border bg-background text-sm font-mono"
          />
          <button
            type="button"
            disabled={inspectLoading}
            onClick={() => void loadWallet()}
            className={cn(
              "px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 disabled:opacity-50",
            )}
          >
            {inspectLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Load"}
          </button>
        </div>
        {inspectErr ? (
          <p className="text-sm text-destructive">{inspectErr}</p>
        ) : null}
        {inspect ? (
          <div className="space-y-3 text-sm">
            <p>
              <span className="text-muted-foreground">Exists:</span>{" "}
              {inspect.exists ? "yes" : "no"}
              {inspect.tier ? (
                <>
                  {" "}
                  · <span className="text-muted-foreground">Tier:</span> {inspect.tier}
                </>
              ) : null}
            </p>
            <p>
              <span className="text-muted-foreground">Balance (units):</span>{" "}
              <strong className="tabular-nums">{inspect.balanceUnits ?? 0}</strong>
            </p>
            {inspect.ledger && inspect.ledger.length > 0 ? (
              <div className="overflow-x-auto rounded-lg border border-border mt-2">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-border bg-secondary/30 text-left text-[10px] font-mono uppercase text-muted-foreground">
                      <th className="px-2 py-1.5">When</th>
                      <th className="px-2 py-1.5">Dir</th>
                      <th className="px-2 py-1.5">Units</th>
                      <th className="px-2 py-1.5">Reason</th>
                      <th className="px-2 py-1.5">Status</th>
                      <th className="px-2 py-1.5">Tx</th>
                    </tr>
                  </thead>
                  <tbody>
                    {inspect.ledger.map((row) => (
                      <tr key={row.id} className="border-b border-border/60">
                        <td className="px-2 py-1.5 whitespace-nowrap text-muted-foreground">
                          {new Date(row.createdAt).toLocaleString()}
                        </td>
                        <td className="px-2 py-1.5">{row.direction}</td>
                        <td className="px-2 py-1.5 tabular-nums">{row.units}</td>
                        <td className="px-2 py-1.5 max-w-[140px] truncate" title={row.reason}>
                          {row.reason}
                        </td>
                        <td className="px-2 py-1.5 font-mono">{row.status}</td>
                        <td className="px-2 py-1.5">
                          {row.relatedTxSig ? (
                            <a
                              href={solscanTxUrl(row.relatedTxSig)}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-primary inline-flex items-center gap-0.5 hover:underline"
                            >
                              <ExternalLink className="w-3 h-3" />
                            </a>
                          ) : (
                            "—"
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-muted-foreground">No ledger rows.</p>
            )}
          </div>
        ) : null}
      </section>

      <section className="rounded-xl border border-border bg-card/80 p-6 flex flex-col gap-4">
        <h2 className="text-lg font-semibold">Manual ledger adjust</h2>
        <p className="text-xs text-muted-foreground">
          Posts <span className="font-mono">SETTLED</span> credit or debit. Use for support /
          corrections only.
        </p>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-muted-foreground">Wallet</span>
            <input
              value={adjWallet}
              onChange={(e) => setAdjWallet(e.target.value)}
              placeholder="(defaults to inspect field above)"
              className="px-3 py-2 rounded-lg border border-border bg-background font-mono text-xs"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-muted-foreground">Units</span>
            <input
              type="number"
              min={1}
              value={adjUnits}
              onChange={(e) => setAdjUnits(e.target.value)}
              className="px-3 py-2 rounded-lg border border-border bg-background tabular-nums"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-muted-foreground">Direction</span>
            <select
              value={adjDir}
              onChange={(e) => setAdjDir(e.target.value as "CREDIT" | "DEBIT")}
              className="px-3 py-2 rounded-lg border border-border bg-background"
            >
              <option value="CREDIT">CREDIT</option>
              <option value="DEBIT">DEBIT</option>
            </select>
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-muted-foreground">Reason</span>
            <input
              value={adjReason}
              onChange={(e) => setAdjReason(e.target.value)}
              className="px-3 py-2 rounded-lg border border-border bg-background text-sm"
            />
          </label>
        </div>
        <button
          type="button"
          disabled={adjBusy}
          onClick={() => void submitAdjust()}
          className="self-start px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 disabled:opacity-50"
        >
          {adjBusy ? <Loader2 className="w-4 h-4 animate-spin" /> : "Apply adjustment"}
        </button>
        {adjMsg ? (
          <p className={cn("text-sm", adjMsg.includes("failed") || adjMsg.includes("403") ? "text-destructive" : "text-emerald-600 dark:text-emerald-400")}>
            {adjMsg}
          </p>
        ) : null}
      </section>
    </div>
  );
}
