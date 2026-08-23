import { beforeEach, describe, expect, it, vi, afterEach } from "vitest";
import { ApiRequestError, isTransientNetworkError } from "@/lib/api";
import { useAuthStore } from "@/stores/auth-store";
import type { AuthResponse } from "@/types";

const authResponse: AuthResponse = {
  user: {
    id: 1,
    email: "test@example.com",
    full_name: "Test User",
    phone: null,
    preferred_language: "en",
    currency: "INR",
    timezone: "Asia/Kolkata",
  },
  tokens: {
    access_token: "header.payload.sig",
    refresh_token: "header2.payload2.sig2",
    token_type: "bearer",
    expires_in: 1800,
  },
};

function jsonResponse(status: number, body: unknown) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  };
}

function timeoutError() {
  return new DOMException("The operation was aborted due to timeout", "TimeoutError");
}

function mockFetch(handler: (...args: unknown[]) => Promise<unknown>) {
  const fn = vi.fn(handler);
  vi.stubGlobal("fetch", fn);
  return fn;
}

describe("isTransientNetworkError", () => {
  it("classifies timeouts and aborts as transient", () => {
    expect(isTransientNetworkError(timeoutError())).toBe(true);
    expect(isTransientNetworkError(new DOMException("cancelled", "AbortError"))).toBe(true);
  });

  it("classifies connection failures (TypeError) as transient", () => {
    expect(isTransientNetworkError(new TypeError("Failed to fetch"))).toBe(true);
  });

  it("does not classify HTTP errors as transient", () => {
    expect(isTransientNetworkError(new ApiRequestError("Invalid credentials", 401, "UNAUTHORIZED"))).toBe(false);
    expect(isTransientNetworkError(new Error("boom"))).toBe(false);
  });
});

describe("auth store cold-start retry", () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
    useAuthStore.getState().clearAuth();
    vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("logs in after retrying once when the first request times out", async () => {
    const fetchMock = mockFetch(() => {
      if (fetchMock.mock.calls.length === 1) throw timeoutError();
      return Promise.resolve(jsonResponse(200, authResponse));
    });

    await useAuthStore.getState().login("test@example.com", "strong-password-123");

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(useAuthStore.getState().isAuthenticated).toBe(true);
    expect(useAuthStore.getState().user?.email).toBe("test@example.com");
  });

  it("does not retry when the backend rejects invalid credentials", async () => {
    const fetchMock = mockFetch(() =>
      Promise.resolve(
        jsonResponse(401, {
          error: { code: "INVALID_CREDENTIALS", message: "Invalid email or password." },
        }),
      ),
    );

    await expect(
      useAuthStore.getState().login("test@example.com", "wrong-password-1"),
    ).rejects.toBeInstanceOf(ApiRequestError);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(useAuthStore.getState().isAuthenticated).toBe(false);
  });

  it("surfaces the timeout after the retry also fails", async () => {
    const fetchMock = mockFetch(() => {
      throw timeoutError();
    });

    await expect(
      useAuthStore.getState().login("test@example.com", "strong-password-123"),
    ).rejects.toMatchObject({ name: "TimeoutError" });

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(useAuthStore.getState().isAuthenticated).toBe(false);
  });
});
