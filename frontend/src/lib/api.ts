import type { ApiError } from "@/types";

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000/api/v1";

const DEFAULT_TIMEOUT_MS = 30_000;

type RequestOptions = RequestInit & {
  token?: string | null;
  skipAuth?: boolean;
  timeout?: number;
  errorMessages?: Partial<Record<number, string>>;
};

const TOKEN_STORAGE_KEY = "fincompass-tokens";

// Refresh the access token before it expires instead of waiting for a 401,
// so expired sessions never leak raw 401 responses into the console.
const REFRESH_MARGIN_SECONDS = 60;

type AuthFailureHandler = () => void;

const DEFAULT_STATUS_MESSAGES: Partial<Record<number, string>> = {
  401: "Your session has expired. Please sign in again.",
  403: "You don't have permission to access this.",
  404: "The requested resource was not found.",
  413: "The uploaded file is too large.",
  415: "Unsupported file type.",
  422: "The request could not be processed. Please check your input.",
  429: "Too many requests. Please try again shortly.",
  500: "The server encountered an error. Please try again.",
};

const CONSENT_ERROR_MESSAGE =
  "Consent required. Please grant the required permissions in your consent settings to access this feature.";

class ApiClient {
  private accessToken: string | null = null;
  private refreshToken: string | null = null;
  private refreshPromise: Promise<string | null> | null = null;
  private tokensRestored = false;
  private onAuthFailure: AuthFailureHandler | null = null;
  private lastRefreshFailed = false;

  setAuthFailureHandler(handler: AuthFailureHandler) {
    this.onAuthFailure = handler;
  }

  private notifyAuthFailure() {
    this.clearTokens();
    this.onAuthFailure?.();
  }

  private static decodeExp(token: string): number | null {
    if (typeof atob === "undefined") return null;
    try {
      const payload = token.split(".")[1];
      if (!payload) return null;
      const normalized = payload.replace(/-/g, "+").replace(/_/g, "/");
      const padded = normalized + "=".repeat((4 - (normalized.length % 4)) % 4);
      const data = JSON.parse(atob(padded)) as { exp?: number };
      return typeof data.exp === "number" ? data.exp : null;
    } catch {
      return null;
    }
  }

  private isTokenUsable(token: string | null): boolean {
    if (!token) return false;
    const exp = ApiClient.decodeExp(token);
    if (exp == null) return false;
    return exp * 1000 - Date.now() > REFRESH_MARGIN_SECONDS * 1000;
  }

  private restoreTokens() {
    if (this.tokensRestored || typeof window === "undefined") return;
    this.tokensRestored = true;
    try {
      const raw = window.localStorage.getItem(TOKEN_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as {
          accessToken?: string;
          refreshToken?: string;
        };
        this.accessToken = parsed.accessToken ?? null;
        this.refreshToken = parsed.refreshToken ?? null;
      }
    } catch {
      // Ignore storage errors (private mode, corrupted payload).
    }
  }

  private persistTokens() {
    if (typeof window === "undefined") return;
    try {
      if (this.accessToken && this.refreshToken) {
        window.localStorage.setItem(
          TOKEN_STORAGE_KEY,
          JSON.stringify({
            accessToken: this.accessToken,
            refreshToken: this.refreshToken,
          }),
        );
      } else {
        window.localStorage.removeItem(TOKEN_STORAGE_KEY);
      }
    } catch {
      // Ignore storage errors (private mode, quota).
    }
  }

  setTokens(access: string | null, refresh: string | null) {
    this.accessToken = access;
    this.refreshToken = refresh;
    this.lastRefreshFailed = false;
    this.persistTokens();
  }

  getAccessToken() {
    this.restoreTokens();
    return this.accessToken;
  }

  getRefreshToken() {
    return this.refreshToken;
  }

  clearTokens() {
    this.accessToken = null;
    this.refreshToken = null;
    this.lastRefreshFailed = false;
    this.persistTokens();
  }

  async verifySession(): Promise<boolean> {
    this.restoreTokens();
    if (this.isTokenUsable(this.accessToken)) return true;
    if (!this.refreshToken) return false;
    const fresh = await this.refreshAccessToken();
    return fresh !== null;
  }

  private async refreshAccessToken(): Promise<string | null> {
    if (this.lastRefreshFailed) return null;
    if (!this.refreshToken && typeof window === "undefined") return null;
    if (this.refreshPromise) return this.refreshPromise;

    this.refreshPromise = (async () => {
      try {
        const res = await fetch(`${API_BASE}/auth/refresh`, {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ refresh_token: this.refreshToken ?? "" }),
          signal: AbortSignal.timeout(DEFAULT_TIMEOUT_MS),
        });
        if (res.status === 401) {
          this.lastRefreshFailed = true;
          this.notifyAuthFailure();
          return null;
        }
        if (!res.ok) {
          return null;
        }
        const data = await res.json();
        this.accessToken = data.access_token;
        this.refreshToken = data.refresh_token;
        this.lastRefreshFailed = false;
        this.persistTokens();
        return this.accessToken;
      } catch {
        return null;
      } finally {
        this.refreshPromise = null;
      }
    })();

    return this.refreshPromise;
  }

  async request<T>(path: string, options: RequestOptions = {}): Promise<T> {
    this.restoreTokens();
    const { token, skipAuth, timeout = DEFAULT_TIMEOUT_MS, errorMessages, ...init } = options;
    const headers = new Headers(init.headers);
    if (!headers.has("Content-Type") && init.body && !(init.body instanceof FormData)) {
      headers.set("Content-Type", "application/json");
    }

    const authToken = skipAuth ? null : (token ?? this.accessToken);
    if (authToken) headers.set("Authorization", `Bearer ${authToken}`);

    if (!skipAuth && !token) {
      const current = this.accessToken;
      if (!this.isTokenUsable(current)) {
        const fresh = await this.refreshAccessToken();
        if (fresh) headers.set("Authorization", `Bearer ${fresh}`);
      }
    }

    const signal = init.signal ?? AbortSignal.timeout(timeout);

    let res = await fetch(`${API_BASE}${path}`, {
      ...init,
      headers,
      credentials: "include",
      signal,
    });

    if (res.status === 401 && !skipAuth) {
      const newToken = await this.refreshAccessToken();
      if (newToken) {
        headers.set("Authorization", `Bearer ${newToken}`);
        res = await fetch(`${API_BASE}${path}`, {
          ...init,
          headers,
          credentials: "include",
          signal,
        });
      }
    }

    if (res.status === 204) return undefined as T;

    const data = await res.json().catch(() => null);
    if (!res.ok) {
      const err = data as ApiError;
      const isConsentDenied = err?.error?.code === "CONSENT_DENIED";
      const fallback =
        errorMessages?.[res.status] ??
        (isConsentDenied ? CONSENT_ERROR_MESSAGE : undefined) ??
        (res.status === 401 && !skipAuth ? DEFAULT_STATUS_MESSAGES[401] : undefined) ??
        err?.error?.message ??
        DEFAULT_STATUS_MESSAGES[res.status] ??
        "Something went wrong.";
      throw new ApiRequestError(fallback, res.status, err?.error?.code ?? "UNKNOWN");
    }
    return data as T;
  }

  get<T>(path: string, options?: RequestOptions) {
    return this.request<T>(path, { ...options, method: "GET" });
  }

  post<T>(path: string, body?: unknown, options?: RequestOptions) {
    const isFormData = body instanceof FormData;
    return this.request<T>(path, {
      ...options,
      method: "POST",
      body: isFormData ? body : body ? JSON.stringify(body) : undefined,
    });
  }

  patch<T>(path: string, body?: unknown, options?: RequestOptions) {
    return this.request<T>(path, {
      ...options,
      method: "PATCH",
      body: body ? JSON.stringify(body) : undefined,
    });
  }

  delete<T>(path: string, options?: RequestOptions) {
    return this.request<T>(path, { ...options, method: "DELETE" });
  }
}

export class ApiRequestError extends Error {
  constructor(
    message: string,
    public status: number,
    public code: string,
  ) {
    super(message);
    this.name = "ApiRequestError";
  }
}

export const api = new ApiClient();
