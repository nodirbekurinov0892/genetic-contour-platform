import { apiFetch } from "@/lib/api";
import { clearTokens, getRefreshToken, setTokens, syncSessionCookie } from "@/lib/auth-storage";
import { detailFromBody, toUserFacingNetworkError } from "@/lib/network-errors";

function syncSessionCookieFromBff(): void {
  syncSessionCookie();
}

export interface AuthUser {
  id: string;
  email: string;
  name: string | null;
  role: string;
  is_active: boolean;
  email_verified?: boolean;
  onboarding_completed_at?: string | null;
  created_at: string;
  updated_at: string;
}

export interface TokenResponse {
  access_token: string;
  refresh_token: string;
  token_type: string;
}

async function authBffFetch(
  path: string,
  body: unknown,
  fallbackError: string,
): Promise<void> {
  try {
    const res = await fetch(path, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      credentials: "include",
    });
    if (!res.ok) {
      const payload = (await res.json().catch(() => ({}))) as Record<string, unknown>;
      throw new Error(detailFromBody(payload, fallbackError));
    }
  } catch (err) {
    throw toUserFacingNetworkError(err, fallbackError);
  }
}

export const authService = {
  async register(data: {
    email: string;
    password: string;
    name?: string;
  }): Promise<void> {
    await authBffFetch("/api/auth/register", data, "Ro'yxatdan o'tish muvaffaqiyatsiz");
  },

  async login(data: { email: string; password: string }): Promise<void> {
    await authBffFetch("/api/auth/login", data, "Kirish muvaffaqiyatsiz");
    setTokens("cookie", "cookie");
    syncSessionCookieFromBff();
  },

  async refresh(): Promise<TokenResponse> {
    const refreshToken = getRefreshToken();
    if (!refreshToken) {
      throw new Error("No refresh token");
    }
    const tokens = await apiFetch<TokenResponse>("/api/auth/refresh", {
      method: "POST",
      body: JSON.stringify({ refresh_token: refreshToken }),
      skipAuth: true,
    });
    setTokens(tokens.access_token, tokens.refresh_token);
    return tokens;
  },

  async logout(): Promise<void> {
    try {
      await fetch("/api/auth/logout", { method: "POST", credentials: "include" });
    } catch {
      // ignore
    }
    clearTokens();
  },

  me(): Promise<AuthUser> {
    return apiFetch<AuthUser>("/api/auth/me");
  },
};
