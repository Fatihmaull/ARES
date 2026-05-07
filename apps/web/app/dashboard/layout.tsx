"use client";

import { Sidebar } from "@/components/ares/sidebar";
import { SolanaWalletProviders } from "@/components/wallet/solana-wallet-providers";
import { WalletSessionControls } from "@/components/wallet/wallet-session-controls";
import { NotificationBell } from "@/components/ares/notification-bell";
import { HealthIndicator } from "@/components/ares/health-indicator";
import { Moon, Sun } from "lucide-react";
import { useUIStore } from "@/lib/ares/store";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const theme = useUIStore((s) => s.theme);
  const setTheme = useUIStore((s) => s.setTheme);
  const isDark = theme === "dark";

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
          {children}
        </main>
      </div>
      </div>
    </SolanaWalletProviders>
  );
}
