import { apiFetch } from "@/lib/api";
import { clearTokens, getRefreshToken, setTokens } from "@/lib/auth-storage";

export interface AuthUser {
  id: string;
  email: string;
  name: string | null;
  role: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface TokenResponse {
  access_token: string;
  refresh_token: string;
  token_type: string;
}

export const authService = {
  register(data: {
    email: string;
    password: string;
    name?: string;
  }): Promise<TokenResponse> {
    return apiFetch<TokenResponse>("/api/auth/register", {
      method: "POST",
      body: JSON.stringify(data),
      skipAuth: true,
    });
  },

  login(data: { email: string; password: string }): Promise<TokenResponse> {
    return apiFetch<TokenResponse>("/api/auth/login", {
      method: "POST",
      body: JSON.stringify(data),
      skipAuth: true,
    });
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
    const refreshToken = getRefreshToken();
    if (refreshToken) {
      try {
        await apiFetch("/api/auth/logout", {
          method: "POST",
          body: JSON.stringify({ refresh_token: refreshToken }),
          skipAuth: true,
        });
      } catch {
        // Clear local session even if server logout fails
      }
    }
    clearTokens();
  },

  me(): Promise<AuthUser> {
    return apiFetch<AuthUser>("/api/auth/me");
  },
};
