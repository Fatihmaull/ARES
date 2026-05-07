"use client";

import { Bell } from "lucide-react";
import { cn } from "@/lib/utils";
import { useEffect, useRef, useState } from "react";
import { safeResponseJson } from "@/lib/safe-response-json";
import type { NotificationItem } from "@/lib/ares/types";

interface NotificationsResponse {
  notifications: NotificationItem[];
  unread: number;
}

export function NotificationBell() {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [unread, setUnread] = useState(0);
  const [loading, setLoading] = useState(false);
  const dropdownRef = useRef<HTMLDivElement | null>(null);

  async function load() {
    setLoading(true);
    try {
      const res = await fetch("/api/notifications", { cache: "no-store" });
      if (!res.ok) {
        setItems([]);
        setUnread(0);
        return;
      }
      const body = await safeResponseJson<{ data?: NotificationsResponse } & NotificationsResponse>(res);
      const payload = body?.data ?? body ?? null;
      if (payload) {
        setItems(payload.notifications ?? []);
        setUnread(payload.unread ?? 0);
      }
    } catch {
      setItems([]);
      setUnread(0);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    const interval = setInterval(load, 30_000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (!open) return;
    function handleDocumentClick(event: MouseEvent) {
      if (!dropdownRef.current) return;
      if (!dropdownRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleDocumentClick);
    return () => document.removeEventListener("mousedown", handleDocumentClick);
  }, [open]);

  async function handleMarkAllRead() {
    try {
      await fetch("/api/notifications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "mark-all-read" }),
      });
    } catch {
      // Best-effort; refresh either way.
    }
    await load();
  }

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        type="button"
        onClick={() => {
          setOpen((prev) => !prev);
          if (!open) {
            void load();
          }
        }}
        className="p-2 text-muted-foreground hover:text-foreground transition-all hover:bg-secondary/50 rounded-lg relative"
        aria-label={
          unread > 0
            ? `Notifications (${unread} unread)`
            : "Notifications"
        }
      >
        <Bell className="w-5 h-5" />
        {unread > 0 && (
          <span className="absolute top-1 right-1 min-w-[16px] h-4 px-1 bg-primary text-primary-foreground text-[10px] font-semibold rounded-full border-2 border-card flex items-center justify-center">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>
      {open && (
        <div className="absolute right-0 mt-2 w-80 max-h-[480px] overflow-y-auto rounded-xl border border-border bg-card shadow-xl z-50">
          <div className="flex items-center justify-between px-4 py-3 border-b border-border">
            <h4 className="text-sm font-semibold">Notifications</h4>
            <button
              type="button"
              onClick={handleMarkAllRead}
              className={cn(
                "text-[11px] font-mono uppercase tracking-[0.18em]",
                unread > 0
                  ? "text-primary hover:text-primary/80"
                  : "text-muted-foreground cursor-default",
              )}
              disabled={unread === 0}
            >
              Mark all read
            </button>
          </div>
          {loading && items.length === 0 ? (
            <div className="px-4 py-8 text-center text-sm text-muted-foreground">
              Loading…
            </div>
          ) : items.length === 0 ? (
            <div className="px-4 py-10 text-center text-sm text-muted-foreground">
              No notifications yet.
            </div>
          ) : (
            <ul className="divide-y divide-border">
              {items.map((item) => (
                <li
                  key={item.id}
                  className={cn(
                    "px-4 py-3 flex flex-col gap-1",
                    item.readAt ? "opacity-70" : "bg-secondary/30",
                  )}
                >
                  <p className="text-sm font-medium text-foreground">{item.title}</p>
                  {item.body && (
                    <p className="text-xs text-muted-foreground leading-snug">
                      {item.body}
                    </p>
                  )}
                  <p className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground/70 font-mono">
                    {new Date(item.createdAt).toLocaleString()}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
