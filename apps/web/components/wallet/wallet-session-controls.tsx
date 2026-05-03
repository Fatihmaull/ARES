"use client";

import { useWallet } from "@solana/wallet-adapter-react";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import bs58 from "bs58";
import Link from "next/link";
import { User } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

type MeState =
  | { status: "loading" }
  | { status: "guest" }
  | { status: "signedIn"; wallet: string; tier: string; balanceUnits: number };

export function WalletSessionControls() {
  const { publicKey, signMessage, connected, disconnect } = useWallet();
  const [me, setMe] = useState<MeState>({ status: "loading" });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const r = await fetch("/api/auth/me", { credentials: "include" });
        const j = (await r.json()) as {
          ok?: boolean;
          data?: {
            authenticated?: boolean;
            wallet?: string;
            tier?: string;
            balanceUnits?: number;
          };
        };
        if (cancelled) return;
        if (!j.ok || !j.data) {
          setMe({ status: "guest" });
          return;
        }
        const d = j.data;
        if (d.authenticated && typeof d.wallet === "string") {
          setMe({
            status: "signedIn",
            wallet: d.wallet,
            tier: typeof d.tier === "string" ? d.tier : "free",
            balanceUnits: typeof d.balanceUnits === "number" ? d.balanceUnits : 0,
          });
        } else {
          setMe({ status: "guest" });
        }
      } catch {
        if (!cancelled) setMe({ status: "guest" });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const signIn = useCallback(async () => {
    setErr(null);
    if (!publicKey || !signMessage) {
      setErr("Connect a wallet first.");
      return;
    }
    setBusy(true);
    try {
      const ch = await fetch("/api/auth/challenge", {
        method: "POST",
        credentials: "include",
      });
      const cj = (await ch.json()) as {
        ok?: boolean;
        data?: { message?: string };
        error?: { message?: string };
      };
      if (!cj.ok || !cj.data?.message) {
        throw new Error(cj.error?.message || "Challenge failed");
      }
      const message = cj.data.message;
      const encoded = new TextEncoder().encode(message);
      const sigBytes = await signMessage(encoded);
      const sig58 = bs58.encode(sigBytes);
      const vr = await fetch("/api/auth/verify", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          address: publicKey.toBase58(),
          signature: sig58,
          signedMessage: message,
        }),
      });
      const vj = (await vr.json()) as { ok?: boolean; error?: { message?: string } };
      if (!vj.ok) {
        throw new Error(vj.error?.message || "Verify failed");
      }
      window.location.reload();
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }, [publicKey, signMessage]);

  const signOut = useCallback(async () => {
    setBusy(true);
    try {
      await fetch("/api/auth/logout", { method: "POST", credentials: "include" });
      await disconnect();
      window.location.reload();
    } finally {
      setBusy(false);
    }
  }, [disconnect]);

  function shortPk(s: string) {
    if (s.length <= 12) return s;
    return `${s.slice(0, 4)}…${s.slice(-4)}`;
  }

  const pk58 = publicKey?.toBase58();
  const needsSignIn =
    connected &&
    pk58 &&
    (me.status !== "signedIn" || me.wallet !== pk58);

  if (me.status === "loading") {
    return (
      <div className="text-xs text-muted-foreground whitespace-nowrap">Session…</div>
    );
  }

  return (
    <div className="flex flex-col items-end gap-1 max-w-[min(100vw-2rem,320px)]">
      <div className="flex flex-wrap items-center justify-end gap-2">
        <Link
          href="/dashboard/profile"
          className="p-2 text-muted-foreground hover:text-foreground transition-all hover:bg-secondary/50 rounded-lg border border-transparent hover:border-border"
          aria-label="Profile"
        >
          <User className="w-5 h-5" />
        </Link>
        <WalletMultiButton />
        {needsSignIn ? (
          <button
            type="button"
            disabled={busy}
            onClick={() => void signIn()}
            className="text-xs font-medium px-3 py-2 rounded-lg bg-primary text-primary-foreground hover:opacity-90 disabled:opacity-50"
          >
            {busy ? "Signing…" : "Sign in"}
          </button>
        ) : null}
        {me.status === "signedIn" ? (
          <button
            type="button"
            disabled={busy}
            onClick={() => void signOut()}
            className="text-xs font-medium px-3 py-2 rounded-lg border border-border hover:bg-secondary/50 disabled:opacity-50"
          >
            Sign out
          </button>
        ) : null}
      </div>
      {me.status === "signedIn" ? (
        <div className="text-[11px] text-muted-foreground font-mono text-right leading-snug">
          <span>{shortPk(me.wallet)}</span>
          <span className="mx-1">·</span>
          <span>{me.balanceUnits} units</span>
          <span className="mx-1">·</span>
          <span>{me.tier}</span>
        </div>
      ) : (
        <p className="text-[11px] text-muted-foreground text-right leading-snug">
          Connect a wallet, then Sign in to attach your session cookie.
        </p>
      )}
      {err ? (
        <p className="text-[11px] text-destructive text-right max-w-[260px] leading-snug">{err}</p>
      ) : null}
    </div>
  );
}
