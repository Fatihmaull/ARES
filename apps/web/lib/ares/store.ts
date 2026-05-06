import { create } from "zustand";

/** App-wide color mode: landing, marketing, and dashboard share the same value. */
export type Theme = "dark" | "light";

/** @deprecated Use `Theme` */
export type DashboardTheme = Theme;

interface UIState {
  sidebarCollapsed: boolean;
  setSidebarCollapsed: (val: boolean) => void;
  activeTargetId: string | null;
  setActiveTargetId: (id: string | null) => void;
  theme: Theme;
  setTheme: (t: Theme) => void;
}

export const useUIStore = create<UIState>((set) => ({
  sidebarCollapsed: false,
  setSidebarCollapsed: (val) => set({ sidebarCollapsed: val }),
  activeTargetId: null,
  setActiveTargetId: (id) => set({ activeTargetId: id }),
  theme: "dark",
  setTheme: (t) => set({ theme: t }),
}));
