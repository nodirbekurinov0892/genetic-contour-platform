const ACCESS_TOKEN_KEY = "gc_access_token";
const REFRESH_TOKEN_KEY = "gc_refresh_token";
const SESSION_COOKIE = "gc_session";

function sessionCookieAttributes(): string {
  const secure =
    typeof window !== "undefined" && window.location.protocol === "https:" ? "; Secure" : "";
  return `path=/; SameSite=Lax${secure}`;
}

function setSessionCookie(): void {
  if (typeof document === "undefined") return;
  document.cookie = `${SESSION_COOKIE}=1; ${sessionCookieAttributes()}`;
}

function clearSessionCookie(): void {
  if (typeof document === "undefined") return;
  document.cookie = `${SESSION_COOKIE}=; Max-Age=0; ${sessionCookieAttributes()}`;
}

/** Keep middleware session cookie aligned with stored access tokens. */
export function syncSessionCookie(): void {
  if (typeof window === "undefined") return;
  if (getAccessToken() || document.cookie.includes(`${SESSION_COOKIE}=1`)) {
    setSessionCookie();
  } else {
    clearSessionCookie();
  }
}

export function getAccessToken(): string | null {
  if (typeof window === "undefined") return null;
  const token = localStorage.getItem(ACCESS_TOKEN_KEY);
  if (token === "cookie") return null;
  return token;
}

export function getRefreshToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(REFRESH_TOKEN_KEY);
}

export function hasStoredAccessToken(): boolean {
  if (typeof document !== "undefined" && document.cookie.includes("gc_session=1")) {
    return true;
  }
  const token = getAccessToken();
  return !!token;
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
