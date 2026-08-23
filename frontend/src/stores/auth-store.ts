"use client";

import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { api, isTransientNetworkError } from "@/lib/api";
import { clearQueryCache } from "@/lib/query-client";
import type { AuthResponse, UserSummary } from "@/types";

const STORAGE_KEY = "fincompass-auth";
const STORAGE_KEY_SESSION = "fincompass-auth-session";

// Render free-tier instances sleep when idle and take ~30-90s to boot.
// The first request can be held by the platform past the default 30s
// client timeout while the instance wakes up; the retry lands on the
// now-warm instance. One understood-purpose retry, not a blind loop.
const COLD_START_RETRY_TIMEOUT_MS = 90_000;

async function postWithColdStartRetry<T>(path: string, body: unknown): Promise<T> {
  try {
    return await api.post<T>(path, body, { skipAuth: true });
  } catch (err) {
    if (!isTransientNetworkError(err)) throw err;
    console.warn(`Auth request to ${path} failed transiently (likely cold start), retrying once`, err);
    return await api.post<T>(path, body, {
      skipAuth: true,
      timeout: COLD_START_RETRY_TIMEOUT_MS,
    });
  }
}

let _rememberMe = false;

export function setRememberMe(value: boolean) {
  _rememberMe = value;
}

interface PersistedAuthState {
  user: UserSummary | null;
  isAuthenticated: boolean;
}

function createConditionalStorage() {
  return {
    getItem: (name: string) => {
      if (typeof window === "undefined") return null;
      const sessionData = window.sessionStorage.getItem(
        name === STORAGE_KEY ? STORAGE_KEY_SESSION : name,
      );
      if (sessionData) return sessionData;
      return window.localStorage.getItem(name);
    },
    setItem: (name: string, value: string) => {
      if (typeof window === "undefined") return;
      if (_rememberMe) {
        window.localStorage.setItem(name, value);
        window.sessionStorage.removeItem(
          name === STORAGE_KEY ? STORAGE_KEY_SESSION : name,
        );
      } else {
        window.sessionStorage.setItem(
          name === STORAGE_KEY ? STORAGE_KEY_SESSION : name,
          value,
        );
        window.localStorage.removeItem(name);
      }
    },
    removeItem: (name: string) => {
      if (typeof window === "undefined") return;
      window.localStorage.removeItem(name);
      window.sessionStorage.removeItem(
        name === STORAGE_KEY ? STORAGE_KEY_SESSION : name,
      );
    },
  };
}

interface AuthState {
  user: UserSummary | null;
  isAuthenticated: boolean;
  isHydrated: boolean;
  setHydrated: (v: boolean) => void;
  login: (email: string, password: string, rememberMe?: boolean) => Promise<void>;
  register: (fullName: string, email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  setAuth: (data: AuthResponse, rememberMe?: boolean) => void;
  clearAuth: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist<AuthState, [], [], PersistedAuthState>(
    (set) => ({
      user: null,
      isAuthenticated: false,
      isHydrated: false,
      setHydrated: (v) => set({ isHydrated: v }),

      setAuth: (data, rememberMe) => {
        clearQueryCache();
        if (typeof rememberMe === "boolean") {
          setRememberMe(rememberMe);
          api.setRememberMe(rememberMe);
        }
        api.setTokens(
          data.tokens.access_token,
          data.tokens.refresh_token,
          rememberMe,
        );
        set({ user: data.user, isAuthenticated: true });
      },

      clearAuth: () => {
        clearQueryCache();
        api.clearTokens();
        set({ user: null, isAuthenticated: false });
      },

      login: async (email, password, rememberMe = false) => {
        clearQueryCache();
        setRememberMe(rememberMe);
        api.setRememberMe(rememberMe);
        const data = await postWithColdStartRetry<AuthResponse>("/auth/login", {
          email,
          password,
          remember_me: rememberMe,
        });
        set({ user: data.user, isAuthenticated: true });
        api.setTokens(
          data.tokens.access_token,
          data.tokens.refresh_token,
          rememberMe,
        );
      },

      register: async (fullName, email, password) => {
        clearQueryCache();
        setRememberMe(false);
        api.setRememberMe(false);
        const data = await postWithColdStartRetry<AuthResponse>(
          "/auth/register",
          { full_name: fullName, email, password },
        );
        set({ user: data.user, isAuthenticated: true });
        api.setTokens(
          data.tokens.access_token,
          data.tokens.refresh_token,
          false,
        );
      },

      logout: async () => {
        try {
          await api.post("/auth/logout", { refresh_token: api.getRefreshToken() });
        } catch {
          // ignore logout errors
        }
        clearQueryCache();
        api.clearTokens();
        set({ user: null, isAuthenticated: false });
      },
    }),
    {
      name: STORAGE_KEY,
      storage: createJSONStorage(() => createConditionalStorage()),
      partialize: (state): PersistedAuthState => ({
        user: state.user,
        isAuthenticated: state.isAuthenticated,
      }),
      onRehydrateStorage: () => (state) => {
        if (state?.isAuthenticated) {
          const stored = api.getStoredRememberMe();
          setRememberMe(stored);
          api.setRememberMe(stored);
        }
        state?.setHydrated(true);
      },
    },
  ),
);

api.setAuthFailureHandler(() => {
  useAuthStore.getState().clearAuth();
});
