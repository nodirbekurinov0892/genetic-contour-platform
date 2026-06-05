const ACCESS_TOKEN_KEY = "gc_access_token";
const REFRESH_TOKEN_KEY = "gc_refresh_token";
const SESSION_COOKIE = "gc_session";

function setSessionCookie(): void {
  if (typeof document === "undefined") return;
  document.cookie = `${SESSION_COOKIE}=1; path=/; SameSite=Lax`;
}

function clearSessionCookie(): void {
  if (typeof document === "undefined") return;
  document.cookie = `${SESSION_COOKIE}=; path=/; Max-Age=0; SameSite=Lax`;
}

export function getAccessToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(ACCESS_TOKEN_KEY);
}

export function getRefreshToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(REFRESH_TOKEN_KEY);
}

export function setTokens(accessToken: string, refreshToken: string): void {
  localStorage.setItem(ACCESS_TOKEN_KEY, accessToken);
  localStorage.setItem(REFRESH_TOKEN_KEY, refreshToken);
  setSessionCookie();
}

export function clearTokens(): void {
  localStorage.removeItem(ACCESS_TOKEN_KEY);
  localStorage.removeItem(REFRESH_TOKEN_KEY);
  clearSessionCookie();
}

/** Cookie name used by Next.js middleware for route gating (not a security token). */
export const AUTH_SESSION_COOKIE = SESSION_COOKIE;
