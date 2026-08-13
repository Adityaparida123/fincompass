"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import { api } from "@/lib/api";
import type { AuthResponse, UserSummary } from "@/types";

interface AuthState {
  user: UserSummary | null;
  isAuthenticated: boolean;
  isHydrated: boolean;
  setHydrated: (v: boolean) => void;
  login: (email: string, password: string, rememberMe?: boolean) => Promise<void>;
  register: (fullName: string, email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  setAuth: (data: AuthResponse) => void;
  clearAuth: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      isAuthenticated: false,
      isHydrated: false,
      setHydrated: (v) => set({ isHydrated: v }),

      setAuth: (data) => {
        api.setTokens(data.tokens.access_token, data.tokens.refresh_token);
        set({ user: data.user, isAuthenticated: true });
      },

      clearAuth: () => {
        api.clearTokens();
        set({ user: null, isAuthenticated: false });
      },

      login: async (email, password, rememberMe = false) => {
        const data = await api.post<AuthResponse>(
          "/auth/login",
          { email, password, remember_me: rememberMe },
          { skipAuth: true },
        );
        set({ user: data.user, isAuthenticated: true });
        api.setTokens(data.tokens.access_token, data.tokens.refresh_token);
      },

      register: async (fullName, email, password) => {
        const data = await api.post<AuthResponse>(
          "/auth/register",
          { full_name: fullName, email, password },
          { skipAuth: true },
        );
        set({ user: data.user, isAuthenticated: true });
        api.setTokens(data.tokens.access_token, data.tokens.refresh_token);
      },

      logout: async () => {
        try {
          await api.post("/auth/logout", { refresh_token: api.getRefreshToken() });
        } catch {
          // ignore logout errors
        }
        api.clearTokens();
        set({ user: null, isAuthenticated: false });
      },
    }),
    {
      name: "fincompass-auth",
      partialize: (state) => ({ user: state.user, isAuthenticated: state.isAuthenticated }),
      onRehydrateStorage: () => (state) => {
        state?.setHydrated(true);
      },
    },
  ),
);
