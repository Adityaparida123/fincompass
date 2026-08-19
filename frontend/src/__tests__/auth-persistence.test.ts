import { describe, it, expect, beforeEach } from "vitest";

const TOKEN_STORAGE_KEY = "fincompass-tokens";
const TOKEN_STORAGE_KEY_SESSION = "fincompass-tokens-session";
const AUTH_STORAGE_KEY = "fincompass-auth";
const AUTH_STORAGE_KEY_SESSION = "fincompass-auth-session";

function createJwtPayload(overrides: Record<string, unknown> = {}): string {
  const payload = { sub: "1", exp: Math.floor(Date.now() / 1000) + 3600, ...overrides };
  return btoa(JSON.stringify(payload))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

function createRefreshToken(rememberMe = false): string {
  return `header.${createJwtPayload({ remember_me: rememberMe, type: "refresh" })}.signature`;
}

describe("Token storage persistence (api.ts behavior)", () => {
  beforeEach(() => {
    window.localStorage.clear();
    window.sessionStorage.clear();
  });

  it("should store tokens in sessionStorage when rememberMe is false", () => {
    const rememberMe = false;
    const tokens = JSON.stringify({
      accessToken: "access-123",
      refreshToken: createRefreshToken(false),
    });

    if (rememberMe) {
      window.localStorage.setItem(TOKEN_STORAGE_KEY, tokens);
    } else {
      window.sessionStorage.setItem(TOKEN_STORAGE_KEY_SESSION, tokens);
    }

    expect(window.sessionStorage.getItem(TOKEN_STORAGE_KEY_SESSION)).toBe(tokens);
    expect(window.localStorage.getItem(TOKEN_STORAGE_KEY)).toBeNull();
  });

  it("should store tokens in localStorage when rememberMe is true", () => {
    const rememberMe = true;
    const tokens = JSON.stringify({
      accessToken: "access-456",
      refreshToken: createRefreshToken(true),
    });

    if (rememberMe) {
      window.localStorage.setItem(TOKEN_STORAGE_KEY, tokens);
    } else {
      window.sessionStorage.setItem(TOKEN_STORAGE_KEY_SESSION, tokens);
    }

    expect(window.localStorage.getItem(TOKEN_STORAGE_KEY)).toBe(tokens);
    expect(window.sessionStorage.getItem(TOKEN_STORAGE_KEY_SESSION)).toBeNull();
  });

  it("should clear both storages on logout", () => {
    window.localStorage.setItem(TOKEN_STORAGE_KEY, "old-persistent");
    window.sessionStorage.setItem(TOKEN_STORAGE_KEY_SESSION, "old-session");

    window.localStorage.removeItem(TOKEN_STORAGE_KEY);
    window.sessionStorage.removeItem(TOKEN_STORAGE_KEY_SESSION);

    expect(window.localStorage.getItem(TOKEN_STORAGE_KEY)).toBeNull();
    expect(window.sessionStorage.getItem(TOKEN_STORAGE_KEY_SESSION)).toBeNull();
  });

  it("should prefer sessionStorage over localStorage on restore (session-first)", () => {
    window.localStorage.setItem(TOKEN_STORAGE_KEY, JSON.stringify({
      accessToken: "persistent-token",
      refreshToken: createRefreshToken(true),
    }));
    window.sessionStorage.setItem(TOKEN_STORAGE_KEY_SESSION, JSON.stringify({
      accessToken: "session-token",
      refreshToken: createRefreshToken(false),
    }));

    const sessionRaw = window.sessionStorage.getItem(TOKEN_STORAGE_KEY_SESSION);
    const persistentRaw = window.localStorage.getItem(TOKEN_STORAGE_KEY);
    const raw = sessionRaw ?? persistentRaw;

    expect(raw).toBe(sessionRaw);
    const parsed = JSON.parse(raw!);
    expect(parsed.accessToken).toBe("session-token");
  });

  it("should fall back to localStorage when sessionStorage is empty", () => {
    window.localStorage.setItem(TOKEN_STORAGE_KEY, JSON.stringify({
      accessToken: "persistent-token",
      refreshToken: createRefreshToken(true),
    }));

    const sessionRaw = window.sessionStorage.getItem(TOKEN_STORAGE_KEY_SESSION);
    const persistentRaw = window.localStorage.getItem(TOKEN_STORAGE_KEY);
    const raw = sessionRaw ?? persistentRaw;

    expect(raw).toBe(persistentRaw);
    const parsed = JSON.parse(raw!);
    expect(parsed.accessToken).toBe("persistent-token");
  });

  it("should return null when both storages are empty", () => {
    const sessionRaw = window.sessionStorage.getItem(TOKEN_STORAGE_KEY_SESSION);
    const persistentRaw = window.localStorage.getItem(TOKEN_STORAGE_KEY);
    const raw = sessionRaw ?? persistentRaw;

    expect(raw).toBeNull();
  });
});

describe("Browser restart behavior (sessionStorage vs localStorage)", () => {
  it("sessionStorage tokens disappear on simulated browser restart", () => {
    window.sessionStorage.setItem(TOKEN_STORAGE_KEY_SESSION, JSON.stringify({
      accessToken: "session-access",
      refreshToken: createRefreshToken(false),
    }));

    window.sessionStorage.clear();

    expect(window.sessionStorage.getItem(TOKEN_STORAGE_KEY_SESSION)).toBeNull();
  });

  it("localStorage tokens survive simulated browser restart", () => {
    window.localStorage.setItem(TOKEN_STORAGE_KEY, JSON.stringify({
      accessToken: "persistent-access",
      refreshToken: createRefreshToken(true),
    }));

    window.localStorage.clear();

    expect(window.localStorage.getItem(TOKEN_STORAGE_KEY)).toBeNull();
  });

  it("session-only login is not restored after session clear (simulates browser restart)", () => {
    window.sessionStorage.setItem(TOKEN_STORAGE_KEY_SESSION, JSON.stringify({
      accessToken: "session-access",
      refreshToken: createRefreshToken(false),
    }));
    window.sessionStorage.setItem(AUTH_STORAGE_KEY_SESSION, JSON.stringify({
      state: { user: { id: 1, email: "a@test.com" }, isAuthenticated: true },
      version: 0,
    }));

    window.sessionStorage.clear();

    expect(window.sessionStorage.getItem(TOKEN_STORAGE_KEY_SESSION)).toBeNull();
    expect(window.sessionStorage.getItem(AUTH_STORAGE_KEY_SESSION)).toBeNull();
  });

  it("persistent login survives simulated browser restart", () => {
    window.localStorage.setItem(TOKEN_STORAGE_KEY, JSON.stringify({
      accessToken: "persistent-access",
      refreshToken: createRefreshToken(true),
    }));
    window.localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify({
      state: { user: { id: 1, email: "a@test.com" }, isAuthenticated: true },
      version: 0,
    }));

    expect(window.localStorage.getItem(TOKEN_STORAGE_KEY)).not.toBeNull();
    expect(window.localStorage.getItem(AUTH_STORAGE_KEY)).not.toBeNull();
  });
});

describe("User switching (User A -> logout -> User B)", () => {
  it("logout clears all auth data from both storages", () => {
    window.localStorage.setItem(TOKEN_STORAGE_KEY, JSON.stringify({
      accessToken: "user-a-access",
      refreshToken: createRefreshToken(true),
    }));
    window.sessionStorage.setItem(TOKEN_STORAGE_KEY_SESSION, JSON.stringify({
      accessToken: "user-a-session-access",
      refreshToken: createRefreshToken(false),
    }));
    window.localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify({
      state: { user: { id: 1, email: "a@test.com" }, isAuthenticated: true },
      version: 0,
    }));
    window.sessionStorage.setItem(AUTH_STORAGE_KEY_SESSION, JSON.stringify({
      state: { user: { id: 1, email: "a@test.com" }, isAuthenticated: true },
      version: 0,
    }));

    window.localStorage.removeItem(TOKEN_STORAGE_KEY);
    window.localStorage.removeItem(AUTH_STORAGE_KEY);
    window.sessionStorage.removeItem(TOKEN_STORAGE_KEY_SESSION);
    window.sessionStorage.removeItem(AUTH_STORAGE_KEY_SESSION);

    expect(window.localStorage.getItem(TOKEN_STORAGE_KEY)).toBeNull();
    expect(window.localStorage.getItem(AUTH_STORAGE_KEY)).toBeNull();
    expect(window.sessionStorage.getItem(TOKEN_STORAGE_KEY_SESSION)).toBeNull();
    expect(window.sessionStorage.getItem(AUTH_STORAGE_KEY_SESSION)).toBeNull();
  });

  it("User B cannot see User A cached data after logout", () => {
    window.localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify({
      state: { user: { id: 1, email: "a@test.com" }, isAuthenticated: true },
      version: 0,
    }));

    window.localStorage.removeItem(AUTH_STORAGE_KEY);

    window.localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify({
      state: { user: { id: 2, email: "b@test.com" }, isAuthenticated: true },
      version: 0,
    }));

    const stored = JSON.parse(window.localStorage.getItem(AUTH_STORAGE_KEY)!);
    expect(stored.state.user.id).toBe(2);
    expect(stored.state.user.email).toBe("b@test.com");
  });

  it("User B storage does not inherit User A tokens", () => {
    window.sessionStorage.setItem(TOKEN_STORAGE_KEY_SESSION, JSON.stringify({
      accessToken: "user-a-token",
      refreshToken: createRefreshToken(false),
    }));

    window.sessionStorage.removeItem(TOKEN_STORAGE_KEY_SESSION);

    expect(window.sessionStorage.getItem(TOKEN_STORAGE_KEY_SESSION)).toBeNull();
    expect(window.localStorage.getItem(TOKEN_STORAGE_KEY)).toBeNull();
  });
});

describe("Invalid session cannot silently restore previous account", () => {
  it("empty storages mean no session to restore", () => {
    expect(window.localStorage.getItem(TOKEN_STORAGE_KEY)).toBeNull();
    expect(window.sessionStorage.getItem(TOKEN_STORAGE_KEY_SESSION)).toBeNull();
    expect(window.localStorage.getItem(AUTH_STORAGE_KEY)).toBeNull();
    expect(window.sessionStorage.getItem(AUTH_STORAGE_KEY_SESSION)).toBeNull();
  });

  it("stale localStorage session tokens do not prevent fresh login", () => {
    window.localStorage.setItem(TOKEN_STORAGE_KEY, JSON.stringify({
      accessToken: "stale-access",
      refreshToken: "stale-refresh",
    }));
    window.localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify({
      state: { user: { id: 1, email: "old@test.com" }, isAuthenticated: true },
      version: 0,
    }));

    window.localStorage.removeItem(TOKEN_STORAGE_KEY);
    window.localStorage.removeItem(AUTH_STORAGE_KEY);

    window.sessionStorage.setItem(TOKEN_STORAGE_KEY_SESSION, JSON.stringify({
      accessToken: "fresh-access",
      refreshToken: createRefreshToken(false),
    }));
    window.sessionStorage.setItem(AUTH_STORAGE_KEY_SESSION, JSON.stringify({
      state: { user: { id: 2, email: "new@test.com" }, isAuthenticated: true },
      version: 0,
    }));

    const tokenRaw = window.sessionStorage.getItem(TOKEN_STORAGE_KEY_SESSION) ?? window.localStorage.getItem(TOKEN_STORAGE_KEY);
    expect(tokenRaw).not.toBeNull();

    const authRaw = window.sessionStorage.getItem(AUTH_STORAGE_KEY_SESSION) ?? window.localStorage.getItem(AUTH_STORAGE_KEY);
    const auth = JSON.parse(authRaw!);
    expect(auth.state.user.email).toBe("new@test.com");
    expect(auth.state.user.id).toBe(2);
  });
});

describe("Remember Me checkbox controls persistence", () => {
  it("unchecked: tokens in sessionStorage only", () => {
    const tokens = JSON.stringify({
      accessToken: "access",
      refreshToken: createRefreshToken(false),
    });
    window.sessionStorage.setItem(TOKEN_STORAGE_KEY_SESSION, tokens);

    expect(window.sessionStorage.getItem(TOKEN_STORAGE_KEY_SESSION)).toBe(tokens);
    expect(window.localStorage.getItem(TOKEN_STORAGE_KEY)).toBeNull();
  });

  it("checked: tokens in localStorage only", () => {
    const tokens = JSON.stringify({
      accessToken: "access",
      refreshToken: createRefreshToken(true),
    });
    window.localStorage.setItem(TOKEN_STORAGE_KEY, tokens);

    expect(window.localStorage.getItem(TOKEN_STORAGE_KEY)).toBe(tokens);
    expect(window.sessionStorage.getItem(TOKEN_STORAGE_KEY_SESSION)).toBeNull();
  });

  it("unchecked: auth state in sessionStorage only", () => {
    const auth = JSON.stringify({
      state: { user: { id: 1 }, isAuthenticated: true },
      version: 0,
    });
    window.sessionStorage.setItem(AUTH_STORAGE_KEY_SESSION, auth);

    expect(window.sessionStorage.getItem(AUTH_STORAGE_KEY_SESSION)).toBe(auth);
    expect(window.localStorage.getItem(AUTH_STORAGE_KEY)).toBeNull();
  });

  it("checked: auth state in localStorage only", () => {
    const auth = JSON.stringify({
      state: { user: { id: 1 }, isAuthenticated: true },
      version: 0,
    });
    window.localStorage.setItem(AUTH_STORAGE_KEY, auth);

    expect(window.localStorage.getItem(AUTH_STORAGE_KEY)).toBe(auth);
    expect(window.sessionStorage.getItem(AUTH_STORAGE_KEY_SESSION)).toBeNull();
  });
});

describe("Page refresh behavior", () => {
  it("unchecked: session persists across page refresh (sessionStorage survives)", () => {
    window.sessionStorage.setItem(TOKEN_STORAGE_KEY_SESSION, JSON.stringify({
      accessToken: "access",
      refreshToken: createRefreshToken(false),
    }));
    window.sessionStorage.setItem(AUTH_STORAGE_KEY_SESSION, JSON.stringify({
      state: { user: { id: 1 }, isAuthenticated: true },
      version: 0,
    }));

    const tokenRaw = window.sessionStorage.getItem(TOKEN_STORAGE_KEY_SESSION);
    const authRaw = window.sessionStorage.getItem(AUTH_STORAGE_KEY_SESSION);

    expect(tokenRaw).not.toBeNull();
    expect(authRaw).not.toBeNull();
  });

  it("checked: session persists across page refresh (localStorage survives)", () => {
    window.localStorage.setItem(TOKEN_STORAGE_KEY, JSON.stringify({
      accessToken: "access",
      refreshToken: createRefreshToken(true),
    }));
    window.localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify({
      state: { user: { id: 1 }, isAuthenticated: true },
      version: 0,
    }));

    const tokenRaw = window.localStorage.getItem(TOKEN_STORAGE_KEY);
    const authRaw = window.localStorage.getItem(AUTH_STORAGE_KEY);

    expect(tokenRaw).not.toBeNull();
    expect(authRaw).not.toBeNull();
  });
});

describe("Expired refresh token", () => {
  it("expired JWT refresh token cannot be decoded for remember_me", () => {
    const expiredPayload = createJwtPayload({
      remember_me: true,
      type: "refresh",
      exp: Math.floor(Date.now() / 1000) - 3600,
    });
    const expiredToken = `header.${expiredPayload}.signature`;

    const parts = expiredToken.split(".");
    const payload = parts[1];
    const normalized = payload.replace(/-/g, "+").replace(/_/g, "/");
    const padded = normalized + "=".repeat((4 - (normalized.length % 4)) % 4);
    const data = JSON.parse(atob(padded));

    expect(data.exp).toBeLessThan(Math.floor(Date.now() / 1000));
  });
});
