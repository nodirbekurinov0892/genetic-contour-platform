import { apiFetch } from "@/lib/api";
import { clearTokens, getRefreshToken, setTokens, syncSessionCookie } from "@/lib/auth-storage";

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

export const authService = {
  async register(data: {
    email: string;
    password: string;
    name?: string;
  }): Promise<void> {
    const res = await fetch("/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
      credentials: "include",
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body.detail || "Registration failed");
    }
  },

  async login(data: { email: string; password: string }): Promise<void> {
    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
      credentials: "include",
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body.detail || "Login failed");
    }
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
