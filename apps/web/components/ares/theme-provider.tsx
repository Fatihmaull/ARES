"use client";

import { useEffect, useLayoutEffect } from "react";
import { useUIStore, type Theme } from "@/lib/ares/store";

export const THEME_STORAGE_KEY = "ares-theme";
const LEGACY_KEY = "ares-dashboard-theme";

function readStoredTheme(): Theme | null {
  try {
    const v = localStorage.getItem(THEME_STORAGE_KEY);
    if (v === "light" || v === "dark") return v;
    const legacy = localStorage.getItem(LEGACY_KEY);
    if (legacy === "light" || legacy === "dark") return legacy;
  } catch {
    /* ignore */
  }
  return null;
}

/**
 * Global theme: applies `class="dark"` on `document.documentElement` and
 * syncs with `localStorage` (`ares-theme`, migrating `ares-dashboard-theme`).
 */
export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const theme = useUIStore((s) => s.theme);
  const setTheme = useUIStore((s) => s.setTheme);

  // Hydration: one-time read from localStorage (inline script in layout already set the class)
  useLayoutEffect(() => {
    const stored = readStoredTheme();
    if (stored) setTheme(stored);
  }, [setTheme]);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", theme === "dark");
    try {
      localStorage.setItem(THEME_STORAGE_KEY, theme);
    } catch {
      /* ignore */
    }
  }, [theme]);

  return <>{children}</>;
}
