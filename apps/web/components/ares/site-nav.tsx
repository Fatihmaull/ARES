"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArrowRight, Menu, Moon, Sun } from "lucide-react";
import { Logo } from "./logo";
import { StatusBadge } from "./status-badge";
import { cn } from "@/lib/utils";
import { useUIStore } from "@/lib/ares/store";

const NAV_LINKS = [
  { label: "Intelligence", href: "/intelligence" },
  { label: "Integrations", href: "/integrations" },
  { label: "Pricing", href: "/pricing" },
];

export function SiteNav() {
  const pathname = usePathname();
  const theme = useUIStore((s) => s.theme);
  const setTheme = useUIStore((s) => s.setTheme);
  const isDark = theme === "dark";

  return (
    <nav className="grid-container grid-section--dense border-b border-border">
      <div className="col-span-full flex items-center justify-between cell-pad">
        <div className="flex items-center gap-4 rail-tick pl-3">
          <Link
            href="/"
            className="flex items-center text-foreground hover:text-primary transition-colors"
            aria-label="ARES home"
          >
            <Logo size={22} showMark={false} />
          </Link>
          <span className="hidden sm:inline h-3 w-px bg-border" />
          <StatusBadge
            label="Operators Online"
            className="hidden sm:inline-flex"
          />
        </div>

        <div className="hidden md:flex items-center gap-7 type-sm text-muted-foreground">
          {NAV_LINKS.map((l) => {
            const active =
              pathname === l.href || pathname?.startsWith(l.href + "/");
            return (
              <Link
                key={l.href}
                href={l.href}
                className={cn(
                  "transition-colors hover:text-foreground",
                  active && "text-foreground"
                )}
              >
                {l.label}
              </Link>
            );
          })}
          <span className="h-4 w-px bg-border" />
          <Link
            href="/dashboard/overview"
            className="hover:text-foreground transition-colors"
          >
            Sign In
          </Link>
          <Link
            href="/dashboard/overview"
            className="group inline-flex items-center gap-1.5 text-foreground"
          >
            Launch Console
            <ArrowRight className="w-3.5 h-3.5 transition-transform group-hover:translate-x-0.5" />
          </Link>
          <span className="h-4 w-px bg-border" />
          <button
            type="button"
            onClick={() => setTheme(isDark ? "light" : "dark")}
            className="p-2 text-muted-foreground hover:text-foreground transition-colors rounded-lg border border-transparent hover:border-border"
            title={isDark ? "Mode terang" : "Mode gelap"}
            aria-label={isDark ? "Aktifkan mode terang" : "Aktifkan mode gelap"}
          >
            {isDark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          </button>
        </div>

        <div className="flex items-center gap-1 md:hidden">
          <button
            type="button"
            onClick={() => setTheme(isDark ? "light" : "dark")}
            className="p-2 text-muted-foreground hover:text-foreground rounded-lg border border-transparent hover:border-border"
            title={isDark ? "Mode terang" : "Mode gelap"}
            aria-label={isDark ? "Aktifkan mode terang" : "Aktifkan mode gelap"}
          >
            {isDark ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
          </button>
          <button
            aria-label="Toggle menu"
            className="w-10 h-10 flex items-center justify-center opacity-60 hover:opacity-100"
          >
            <Menu className="w-5 h-5" />
          </button>
        </div>
      </div>
    </nav>
  );
}
