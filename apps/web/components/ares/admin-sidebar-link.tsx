"use client";

import Link from "next/link";
import { Shield } from "lucide-react";
import { useEffect, useState } from "react";

import { cn } from "@/lib/utils";

/**
 * Renders Admin nav entry only when `/api/auth/me` reports `isAdmin`.
 */
export function AdminSidebarLink({
  collapsed,
  pathname,
}: {
  collapsed: boolean;
  pathname: string;
}) {
  const [show, setShow] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const r = await fetch("/api/auth/me", { credentials: "include" });
        const j = (await r.json()) as {
          ok?: boolean;
          data?: { authenticated?: boolean; isAdmin?: boolean };
        };
        if (!cancelled && j.ok && j.data?.authenticated && j.data?.isAdmin) {
          setShow(true);
        }
      } catch {
        /* ignore */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (!show) return null;

  const href = "/dashboard/admin";
  const isActive = pathname === href;

  return (
    <Link
      href={href}
      className={cn(
        "flex items-center gap-3 px-3 py-2 rounded-lg transition-all group relative font-sans text-[15px]",
        isActive
          ? "bg-secondary text-foreground font-medium ring-shadow"
          : "text-muted-foreground hover:bg-muted/50 hover:text-foreground",
      )}
    >
      <Shield className={cn("w-4 h-4 shrink-0 transition-colors", isActive ? "text-primary" : "text-muted-foreground group-hover:text-foreground")} />
      {!collapsed && <span>Admin</span>}
      {collapsed && (
        <span className="sr-only">Admin</span>
      )}
    </Link>
  );
}
