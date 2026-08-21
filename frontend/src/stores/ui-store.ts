"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";

export type Theme = "light" | "dark" | "system";

export type NotificationPref =
  | "budgetAlerts"
  | "expenseReminders"
  | "savingsReminders"
  | "cashflowAlerts"
  | "forecastUpdates";

interface UIState {
  sidebarOpen: boolean;
  theme: Theme;
  notificationSound: boolean;
  finaiEnabled: boolean;
  followUpsEnabled: boolean;
  budgetAlerts: boolean;
  expenseReminders: boolean;
  savingsReminders: boolean;
  cashflowAlerts: boolean;
  forecastUpdates: boolean;
  setSidebarOpen: (open: boolean) => void;
  toggleSidebar: () => void;
  setTheme: (theme: Theme) => void;
  setNotificationSound: (on: boolean) => void;
  setFinaiEnabled: (on: boolean) => void;
  setFollowUpsEnabled: (on: boolean) => void;
  setNotificationPref: (key: NotificationPref, on: boolean) => void;
}

export const useUIStore = create<UIState>()(
  persist(
    (set) => ({
      sidebarOpen: true,
      theme: "system",
      notificationSound: false,
      finaiEnabled: true,
      followUpsEnabled: true,
      budgetAlerts: true,
      expenseReminders: true,
      savingsReminders: true,
      cashflowAlerts: true,
      forecastUpdates: true,
      setSidebarOpen: (open) => set({ sidebarOpen: open }),
      toggleSidebar: () => set((s) => ({ sidebarOpen: !s.sidebarOpen })),
      setTheme: (theme) => set({ theme }),
      setNotificationSound: (on) => set({ notificationSound: on }),
      setFinaiEnabled: (on) => set({ finaiEnabled: on }),
      setFollowUpsEnabled: (on) => set({ followUpsEnabled: on }),
      setNotificationPref: (key, on) => set({ [key]: on } as Partial<UIState>),
    }),
    { name: "fincompass-ui" },
  ),
);
