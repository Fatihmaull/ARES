"use client";

import Link from "next/link";
import { Sidebar } from "@/components/ares/sidebar";
import { Bell, Search, User, ChevronDown, X, Moon, Sun } from "lucide-react";
import { cn } from "@/lib/utils";
import { useState } from "react";
import { useUIStore } from "@/lib/ares/store";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [searchValue, setSearchValue] = useState("");
  const theme = useUIStore((s) => s.theme);
  const setTheme = useUIStore((s) => s.setTheme);
  const isDark = theme === "dark";

  return (
    <div className="flex min-h-screen bg-background text-foreground font-sans selection:bg-primary/20">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0">
        {/* TopBar */}
        <header className="h-16 border-b border-border bg-card/80 backdrop-blur-md sticky top-0 z-40 flex items-center justify-between px-8">
          <div className="flex items-center gap-6 flex-1">
            <div className="flex items-center gap-3 px-3 py-1.5 bg-secondary/50 border border-border rounded-xl text-muted-foreground max-w-md w-full ring-shadow transition-shadow focus-within:ring-ring focus-within:ring-1 group">
              <Search className="w-4 h-4" />
              <input 
                type="text" 
                placeholder="Search targets, detections, or assets..." 
                className="bg-transparent border-none text-[15px] w-full focus:ring-0 placeholder:text-muted-foreground/60 text-foreground"
                value={searchValue}
                onChange={(e) => setSearchValue(e.target.value)}
              />
              {searchValue ? (
                <button onClick={() => setSearchValue("")}>
                   <X className="w-3.5 h-3.5 hover:text-foreground transition-colors" />
                </button>
              ) : (
                <kbd className="ml-auto text-[10px] bg-card px-1.5 py-0.5 rounded border border-border font-mono">⌘ K</kbd>
              )}
            </div>
            
            <div className="h-4 w-px bg-border hidden md:block" />
            
            <div className="items-center gap-4 hidden lg:flex">
              <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground uppercase tracking-widest">
                <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                <span>Monitoring Active</span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setTheme(isDark ? "light" : "dark")}
              className="p-2 text-muted-foreground hover:text-foreground transition-all hover:bg-secondary/50 rounded-lg border border-transparent hover:border-border"
              title={isDark ? "Mode terang" : "Mode gelap"}
              aria-label={isDark ? "Aktifkan mode terang" : "Aktifkan mode gelap"}
            >
              {isDark ? (
                <Sun className="w-5 h-5" />
              ) : (
                <Moon className="w-5 h-5" />
              )}
            </button>
            <Link href="/dashboard/notifications" className="p-2 text-muted-foreground hover:text-foreground transition-all hover:bg-secondary/50 rounded-lg relative">
              <Bell className="w-5 h-5" />
              <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-primary rounded-full border-2 border-card" />
            </Link>
            <div className="h-8 w-px bg-border mx-1" />
            <Link href="/dashboard/profile" className="flex items-center gap-3 p-1.5 hover:bg-secondary/50 rounded-xl transition-all border border-transparent hover:border-border group">
              <div className="w-8 h-8 rounded-full bg-secondary border border-border flex items-center justify-center overflow-hidden">
                 <div className="w-full h-full bg-gradient-to-br from-primary/20 to-secondary flex items-center justify-center">
                    <User className="w-4 h-4 text-primary" />
                 </div>
              </div>
              <div className="text-left hidden sm:block">
                <p className="text-[14px] font-semibold leading-tight">Alice Operator</p>
                <p className="text-[10px] text-muted-foreground font-mono uppercase tracking-tighter">Security Lead</p>
              </div>
              <ChevronDown className="w-4 h-4 text-muted-foreground group-hover:text-foreground ml-1 transition-colors" />
            </Link>
          </div>
        </header>

        <main className="flex-1 p-8 md:p-12 overflow-y-auto w-full max-w-7xl mx-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
