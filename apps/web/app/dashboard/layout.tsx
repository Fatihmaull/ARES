"use client";

import { useEffect, useState } from "react";

import { Sidebar } from "@/components/ares/sidebar";
import { SolanaWalletProviders } from "@/components/wallet/solana-wallet-providers";
import { WalletSessionControls } from "@/components/wallet/wallet-session-controls";
import { NotificationBell } from "@/components/ares/notification-bell";
import { HealthIndicator } from "@/components/ares/health-indicator";
import { Moon, Sun } from "lucide-react";
import { useUIStore } from "@/lib/ares/store";
import { safeResponseJson } from "@/lib/safe-response-json";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const theme = useUIStore((s) => s.theme);
  const setTheme = useUIStore((s) => s.setTheme);
  const isDark = theme === "dark";

  const [auth, setAuth] = useState<
    | { status: "loading" }
    | { status: "guest" }
    | { status: "signedIn"; wallet: string }
  >({ status: "loading" });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/auth/me", { credentials: "include" });
        const body = await safeResponseJson<{
          ok?: boolean;
          data?: { authenticated?: boolean; wallet?: string };
        }>(res);
        if (cancelled) return;
        const d = body?.data;
        if (body?.ok && d?.authenticated && typeof d.wallet === "string") {
          setAuth({ status: "signedIn", wallet: d.wallet });
        } else {
          setAuth({ status: "guest" });
        }
      } catch {
        if (!cancelled) setAuth({ status: "guest" });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <SolanaWalletProviders>
      <div className="flex min-h-screen bg-background text-foreground font-sans selection:bg-primary/20">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0">
        {/* TopBar */}
        <header className="h-16 border-b border-border bg-card/80 backdrop-blur-md sticky top-0 z-40 flex items-center justify-between px-8">
          <div className="flex items-center gap-6 flex-1">
            <HealthIndicator />
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setTheme(isDark ? "light" : "dark")}
              className="p-2 text-muted-foreground hover:text-foreground transition-all hover:bg-secondary/50 rounded-lg border border-transparent hover:border-border"
              title={isDark ? "Light mode" : "Dark mode"}
              aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
            >
              {isDark ? (
                <Sun className="w-5 h-5" />
              ) : (
                <Moon className="w-5 h-5" />
              )}
            </button>
            <NotificationBell />
            <div className="h-8 w-px bg-border mx-1 hidden sm:block" />
            <WalletSessionControls />
          </div>
        </header>

        <main className="flex-1 p-8 md:p-12 overflow-y-auto w-full max-w-7xl mx-auto">
          {auth.status === "loading" ? (
            <div className="py-24 text-center text-muted-foreground">Loading…</div>
          ) : auth.status === "guest" ? (
            <div className="py-24 flex flex-col items-center text-center gap-4">
              <h1 className="text-3xl font-serif">Connect wallet to continue</h1>
              <p className="text-sm text-muted-foreground max-w-xl">
                Dashboard data is private. Connect a wallet and sign to start a
                session, then you&apos;ll be able to see targets, runs, findings,
                reports, and notifications.
              </p>
            </div>
          ) : (
            children
          )}
        </main>
      </div>
      </div>
    </SolanaWalletProviders>
  );
}
