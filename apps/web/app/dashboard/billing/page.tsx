"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  Check,
  Copy,
  ExternalLink,
  Loader2,
  RefreshCw,
  Wallet,
} from "lucide-react";

import { DepositUsdcButton } from "@/components/wallet/deposit-usdc-button";
import { safeResponseJson } from "@/lib/safe-response-json";
import { cn } from "@/lib/utils";

type MeJson = {
  ok?: boolean;
  data?: {
    authenticated?: boolean;
    wallet?: string;
    tier?: string;
    balanceUnits?: number;
  };
};

type BalanceJson = {
  ok?: boolean;
  data?: { wallet?: string; tier?: string; units?: number };
};

type BundlesJson = {
  ok?: boolean;
  data?: {
    bundles?: { id: string; label: string; usdc: number; units: number }[];
  };
};

type PrepareJson = {
  ok?: boolean;
  data?: {
    treasury?: string;
    memo?: string;
    bundleId?: string;
    units?: number;
    usdc?: number;
    label?: string;
    clientNonce?: string;
    mintUsdc?: string | null;
  };
  error?: { message?: string };
};

type HistoryEntry = {
  id: string;
  direction: string;
  units: number;
  reason: string;
  status: string;
  createdAt: string;
  relatedTxSig: string | null;
  relatedRunId: string | null;
};

type HistoryJson = {
  ok?: boolean;
  data?: { entries?: HistoryEntry[] };
  error?: { message?: string };
};

function solscanTxUrl(signature: string): string {
  const net = process.env.NEXT_PUBLIC_SOLANA_NETWORK?.trim();
  const cluster =
    net === "mainnet-beta" ? "" : `?cluster=${encodeURIComponent(net || "devnet")}`;
  return `https://solscan.io/tx/${signature}${cluster}`;
}

async function copyText(
  label: string,
  text: string,
  setHint: (s: string | null) => void,
) {
  try {
    await navigator.clipboard.writeText(text);
    setHint(`${label} copied`);
    setTimeout(() => setHint(null), 2000);
  } catch {
    setHint("Copy failed — select text manually.");
    setTimeout(() => setHint(null), 3000);
  }
}

export default function BillingPage() {
  const [me, setMe] = useState<MeJson["data"] | null>(null);
  const [balanceUnits, setBalanceUnits] = useState<number | null>(null);
  const [bundles, setBundles] = useState<
    { id: string; label: string; usdc: number; units: number }[]
  >([]);
  const [prepare, setPrepare] = useState<PrepareJson["data"] | null>(null);
  const [loading, setLoading] = useState(true);
  const [prepareBusy, setPrepareBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copyHint, setCopyHint] = useState<string | null>(null);
  const [depositBanner, setDepositBanner] = useState<string | null>(null);
  const [ledger, setLedger] = useState<HistoryEntry[]>([]);
  const [ledgerLoading, setLedgerLoading] = useState(false);
  const [ledgerNote, setLedgerNote] = useState<string | null>(null);
  const depositPollBaseline = useRef<number>(0);

  const refreshBalance = useCallback(async () => {
    const r = await fetch("/api/billing/balance", { credentials: "include" });
    const j = (await r.json()) as BalanceJson;
    if (!j.ok || typeof j.data?.units !== "number") return null;
    setBalanceUnits(j.data.units);
    return j.data.units;
  }, []);

  const refreshLedger = useCallback(async () => {
    setLedgerLoading(true);
    setLedgerNote(null);
    try {
      const r = await fetch("/api/billing/history?limit=50", {
        credentials: "include",
      });
      const j = (await safeResponseJson<HistoryJson>(r)) as HistoryJson | null;
      if (!j) {
        setLedger([]);
        setLedgerNote("Could not load activity (unexpected response).");
        return;
      }
      if (!j.ok) {
        setLedger([]);
        setLedgerNote(j.error?.message ?? "Activity unavailable.");
        return;
      }
      setLedger(j.data?.entries ?? []);
    } catch {
      setLedger([]);
      setLedgerNote("Could not load activity.");
    } finally {
      setLedgerLoading(false);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const [meRes, bundleRes] = await Promise.all([
          fetch("/api/auth/me", { credentials: "include" }),
          fetch("/api/billing/bundles", { credentials: "include" }),
        ]);
        const meJson = (await meRes.json()) as MeJson;
        const bundleJson = (await bundleRes.json()) as BundlesJson;
        if (cancelled) return;

        setMe(meJson.data ?? null);

        if (meJson.data?.authenticated) {
          const u =
            typeof meJson.data.balanceUnits === "number"
              ? meJson.data.balanceUnits
              : null;
          if (u !== null) setBalanceUnits(u);
          await refreshBalance();
        } else {
          setBalanceUnits(null);
        }

        setBundles(bundleJson.data?.bundles ?? []);
      } catch (e: unknown) {
        if (!cancelled) setError(e instanceof Error ? e.message : String(e));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [refreshBalance]);

  useEffect(() => {
    if (!me?.authenticated) return;
    void refreshLedger();
  }, [me?.authenticated, refreshLedger]);

  useEffect(() => {
    if (!prepare?.memo) return;
    const started = Date.now();
    const id = window.setInterval(async () => {
      if (Date.now() - started > 120_000) {
        window.clearInterval(id);
        return;
      }
      const next = await refreshBalance();
      if (next !== null && next > depositPollBaseline.current) {
        window.clearInterval(id);
        setPrepare(null);
        setDepositBanner("Deposit detected — balance updated.");
        window.setTimeout(() => setDepositBanner(null), 6000);
        void refreshLedger();
      }
    }, 4000);
    return () => window.clearInterval(id);
  }, [prepare?.memo, prepare?.clientNonce, refreshBalance, refreshLedger]);

  async function onPrepare(bundleId: string) {
    setPrepareBusy(bundleId);
    setError(null);
    try {
      const r = await fetch("/api/billing/prepare", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bundleId }),
      });
      const j = (await r.json()) as PrepareJson;
      if (!j.ok || !j.data) {
        throw new Error(j.error?.message || "Prepare failed");
      }
      const baseline = await refreshBalance();
      depositPollBaseline.current = baseline ?? balanceUnits ?? 0;
      setPrepare(j.data);
      void refreshLedger();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setPrepareBusy(null);
    }
  }

  const signedIn = Boolean(me?.authenticated);

  return (
    <div className="flex flex-col gap-10 max-w-4xl">
      <div className="flex flex-col gap-3">
        <span className="text-[11px] font-mono uppercase tracking-[0.2em] text-muted-foreground">
          Billing
        </span>
        <h1 className="text-3xl font-serif tracking-tight text-foreground">
          Credits & top-ups
        </h1>
        <p className="text-muted-foreground text-[15px] max-w-[62ch] leading-relaxed">
          Wallet sessions use <span className="text-foreground font-medium">ASST units</span>{" "}
          for paid chat and scans. Top up by sending USDC (or SOL when treasury supports it)
          with the generated memo — chain-intake credits your wallet when the transaction lands.
        </p>
      </div>

      {depositBanner ? (
        <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200 flex items-center gap-2">
          <Check className="w-4 h-4 shrink-0" />
          {depositBanner}
        </div>
      ) : null}

      {loading ? (
        <div className="flex items-center gap-2 text-muted-foreground text-sm">
          <Loader2 className="w-4 h-4 animate-spin" />
          Loading billing…
        </div>
      ) : null}

      {error ? (
        <div className="rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      ) : null}

      {!loading && !signedIn ? (
        <div className="rounded-xl border border-border bg-card/60 p-6 flex flex-col gap-4">
          <div className="flex items-start gap-3">
            <Wallet className="w-5 h-5 text-primary shrink-0 mt-0.5" />
            <div>
              <h2 className="font-semibold text-foreground">Sign in required</h2>
              <p className="text-sm text-muted-foreground mt-1 max-w-[54ch]">
                Use <span className="text-foreground">Select Wallet</span> and{" "}
                <span className="text-foreground">Sign in</span> in the top bar to create a
                session, then return here to view bundles and deposit instructions.
              </p>
            </div>
          </div>
          <Link
            href="/dashboard/overview"
            className="inline-flex items-center gap-2 text-sm font-medium text-primary hover:underline w-fit"
          >
            Back to overview
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      ) : null}

      {signedIn ? (
        <>
          <section className="rounded-xl border border-border bg-card/80 p-6 flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="text-xs font-mono uppercase tracking-wider text-muted-foreground">
                Balance
              </p>
              <p className="text-3xl font-serif tabular-nums mt-1">
                {balanceUnits ?? "—"}{" "}
                <span className="text-base font-sans text-muted-foreground">units</span>
              </p>
              <p className="text-xs text-muted-foreground mt-2 font-mono truncate max-w-[280px]">
                {me?.wallet}
              </p>
            </div>
            <button
              type="button"
              onClick={() => {
                void refreshBalance();
                void refreshLedger();
              }}
              className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-border text-sm hover:bg-secondary/50 transition-colors"
            >
              <RefreshCw className="w-4 h-4" />
              Refresh
            </button>
          </section>

          <section className="rounded-xl border border-border bg-card/80 p-6 flex flex-col gap-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-lg font-semibold tracking-tight">Credit activity</h2>
              <button
                type="button"
                disabled={ledgerLoading}
                onClick={() => void refreshLedger()}
                className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border border-border text-xs hover:bg-secondary/50 transition-colors disabled:opacity-50"
              >
                {ledgerLoading ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <RefreshCw className="w-3.5 h-3.5" />
                )}
                Refresh activity
              </button>
            </div>
            {ledgerNote ? (
              <p className="text-sm text-muted-foreground">{ledgerNote}</p>
            ) : null}
            {ledgerLoading && ledger.length === 0 && !ledgerNote ? (
              <p className="text-sm text-muted-foreground flex items-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin" />
                Loading ledger…
              </p>
            ) : null}
            {!ledgerLoading && ledger.length === 0 && !ledgerNote ? (
              <p className="text-sm text-muted-foreground">
                No ledger entries yet — deposits and usage will appear here when the database
                is connected.
              </p>
            ) : null}
            {ledger.length > 0 ? (
              <div className="overflow-x-auto rounded-lg border border-border">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border bg-secondary/30 text-left text-[11px] font-mono uppercase tracking-wider text-muted-foreground">
                      <th className="px-3 py-2 font-medium">When</th>
                      <th className="px-3 py-2 font-medium">Type</th>
                      <th className="px-3 py-2 font-medium tabular-nums">Units</th>
                      <th className="px-3 py-2 font-medium">Reason</th>
                      <th className="px-3 py-2 font-medium">Status</th>
                      <th className="px-3 py-2 font-medium">Chain</th>
                    </tr>
                  </thead>
                  <tbody>
                    {ledger.map((row) => (
                      <tr
                        key={row.id}
                        className="border-b border-border/80 last:border-0 hover:bg-secondary/20"
                      >
                        <td className="px-3 py-2 text-muted-foreground whitespace-nowrap">
                          {new Date(row.createdAt).toLocaleString()}
                        </td>
                        <td className="px-3 py-2">
                          <span
                            className={cn(
                              "font-medium",
                              row.direction === "CREDIT"
                                ? "text-emerald-600 dark:text-emerald-400"
                                : "text-foreground",
                            )}
                          >
                            {row.direction === "CREDIT" ? "Credit" : "Debit"}
                          </span>
                        </td>
                        <td className="px-3 py-2 tabular-nums font-medium">
                          {row.direction === "DEBIT" ? "−" : "+"}
                          {row.units}
                        </td>
                        <td className="px-3 py-2 max-w-[200px] truncate" title={row.reason}>
                          {row.reason}
                        </td>
                        <td className="px-3 py-2">
                          <span className="text-xs font-mono">{row.status}</span>
                        </td>
                        <td className="px-3 py-2">
                          {row.relatedTxSig ? (
                            <a
                              href={solscanTxUrl(row.relatedTxSig)}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 text-primary hover:underline text-xs font-mono"
                            >
                              View
                              <ExternalLink className="w-3 h-3 opacity-70" />
                            </a>
                          ) : (
                            <span className="text-muted-foreground text-xs">—</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : null}
          </section>

          <section className="flex flex-col gap-4">
            <h2 className="text-lg font-semibold tracking-tight">Bundles</h2>
            <div className="grid gap-4 sm:grid-cols-2">
              {bundles.map((b) => (
                <article
                  key={b.id}
                  className="rounded-xl border border-border bg-card/60 p-5 flex flex-col gap-4"
                >
                  <div>
                    <h3 className="font-medium text-foreground">{b.label}</h3>
                    <p className="text-sm text-muted-foreground mt-1">
                      {b.units} units · {b.usdc} USDC
                    </p>
                  </div>
                  <button
                    type="button"
                    disabled={prepareBusy !== null}
                    onClick={() => void onPrepare(b.id)}
                    className={cn(
                      "mt-auto inline-flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors",
                      "bg-primary text-primary-foreground hover:opacity-90 disabled:opacity-50",
                    )}
                  >
                    {prepareBusy === b.id ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Preparing…
                      </>
                    ) : (
                      "Generate memo"
                    )}
                  </button>
                </article>
              ))}
            </div>
          </section>

          {prepare?.treasury && prepare.memo ? (
            <section className="rounded-xl border border-primary/25 bg-primary/5 p-6 flex flex-col gap-4">
              <h2 className="text-lg font-semibold tracking-tight">Complete deposit</h2>
              <p className="text-sm text-muted-foreground max-w-[62ch]">
                Send exactly <strong className="text-foreground">{prepare.usdc} USDC</strong>{" "}
                from the wallet that matches your session. Use{" "}
                <strong className="text-foreground">Pay with wallet</strong> when USDC mint is
                configured — it attaches the SPL memo and transfer in one signed transaction.
                Deposits without a valid memo may require manual reconciliation.
              </p>

              {prepare.mintUsdc && me?.wallet ? (
                <div className="rounded-lg border border-border/80 bg-background/40 p-4 flex flex-col gap-2">
                  <p className="text-[11px] font-mono uppercase tracking-wider text-muted-foreground">
                    Recommended
                  </p>
                  <DepositUsdcButton
                    sessionWallet={me.wallet}
                    treasury={prepare.treasury}
                    mintUsdc={prepare.mintUsdc}
                    memo={prepare.memo}
                    usdc={prepare.usdc ?? 0}
                    onSent={() => {
                      void refreshBalance();
                      void refreshLedger();
                    }}
                  />
                </div>
              ) : null}

              <p className="text-[11px] font-mono uppercase tracking-wider text-muted-foreground">
                Manual transfer
              </p>

              <div className="space-y-3">
                <div>
                  <p className="text-[11px] font-mono uppercase text-muted-foreground mb-1">
                    Treasury
                  </p>
                  <div className="flex flex-wrap items-center gap-2 rounded-lg bg-background/80 border border-border px-3 py-2 font-mono text-xs break-all">
                    <span className="flex-1">{prepare.treasury}</span>
                    <button
                      type="button"
                      className="shrink-0 p-1.5 rounded hover:bg-secondary"
                      aria-label="Copy treasury"
                      onClick={() =>
                        void copyText("Treasury", prepare.treasury!, setCopyHint)
                      }
                    >
                      <Copy className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {prepare.mintUsdc ? (
                  <div>
                    <p className="text-[11px] font-mono uppercase text-muted-foreground mb-1">
                      USDC mint
                    </p>
                    <div className="flex flex-wrap items-center gap-2 rounded-lg bg-background/80 border border-border px-3 py-2 font-mono text-xs break-all">
                      <span className="flex-1">{prepare.mintUsdc}</span>
                      <button
                        type="button"
                        className="shrink-0 p-1.5 rounded hover:bg-secondary"
                        aria-label="Copy mint"
                        onClick={() =>
                          void copyText("Mint", prepare.mintUsdc!, setCopyHint)
                        }
                      >
                        <Copy className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ) : null}

                <div>
                  <p className="text-[11px] font-mono uppercase text-muted-foreground mb-1">
                    Memo (required)
                  </p>
                  <div className="flex flex-wrap items-center gap-2 rounded-lg bg-background/80 border border-border px-3 py-2 font-mono text-xs break-all">
                    <span className="flex-1">{prepare.memo}</span>
                    <button
                      type="button"
                      className="shrink-0 p-1.5 rounded hover:bg-secondary"
                      aria-label="Copy memo"
                      onClick={() =>
                        void copyText("Memo", prepare.memo!, setCopyHint)
                      }
                    >
                      <Copy className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>

              <p className="text-xs text-muted-foreground">
                Polling balance every few seconds for ~2 minutes after you prepare a memo.
                You can leave this page open while confirming in your wallet.
              </p>
            </section>
          ) : null}
        </>
      ) : null}

      {copyHint ? (
        <p className="text-xs text-muted-foreground font-mono">{copyHint}</p>
      ) : null}
    </div>
  );
}
