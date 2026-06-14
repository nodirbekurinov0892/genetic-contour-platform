import { getAccessToken, getRefreshToken, setTokens, clearTokens } from "@/lib/auth-storage";

const DIRECT_API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
const USE_BFF = typeof window !== "undefined";
const API_BASE = USE_BFF ? "/api/backend" : DIRECT_API;
const STORAGE_PUBLIC_BASE =
  process.env.NEXT_PUBLIC_STORAGE_PUBLIC_URL?.replace(/\/$/, "") ?? "";

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

function formatDetail(detail: unknown): string {
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail)) {
    return detail
      .map((item) => {
        if (item && typeof item === "object" && "msg" in item) {
          const loc = "loc" in item && Array.isArray(item.loc)
            ? item.loc.join(".")
            : "";
          return loc ? `${loc}: ${item.msg}` : String(item.msg);
        }
        return String(item);
      })
      .join("; ");
  }
  if (detail && typeof detail === "object" && "message" in detail) {
    return String((detail as { message: unknown }).message);
  }
  return "So'rov bajarilmadi";
}

type ApiFetchOptions = RequestInit & {
  skipAuth?: boolean;
  _retry?: boolean;
};

async function refreshAccessToken(): Promise<boolean> {
  const refreshToken = getRefreshToken();
  if (!refreshToken) return false;

  try {
    const res = await fetch(`${API_BASE}/api/auth/refresh`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refresh_token: refreshToken }),
    });
    if (!res.ok) {
      clearTokens();
      return false;
    }
    const tokens = (await res.json()) as { access_token: string; refresh_token: string };
    setTokens(tokens.access_token, tokens.refresh_token);
    return true;
  } catch {
    clearTokens();
    return false;
  }
}

export async function apiFetch<T>(
  path: string,
  options?: ApiFetchOptions,
): Promise<T> {
  const apiPath = USE_BFF ? path.replace(/^\/api/, "") : path;
  const url = `${API_BASE}${apiPath}`;
  const headers: Record<string, string> = {
    ...(options?.body instanceof FormData
      ? {}
      : { "Content-Type": "application/json" }),
    ...(options?.headers as Record<string, string> | undefined),
  };

  if (!options?.skipAuth) {
    const accessToken = getAccessToken();
    if (accessToken) {
      headers.Authorization = `Bearer ${accessToken}`;
    }
  }

  const res = await fetch(url, {
    ...options,
    headers,
    credentials: USE_BFF ? "include" : options?.credentials,
  });

  if (res.status === 401 && !options?.skipAuth && !options?._retry) {
    const refreshed = await refreshAccessToken();
    if (refreshed) {
      return apiFetch<T>(path, { ...options, _retry: true });
    }
  }

  if (!res.ok) {
    const body = await res.json().catch(() => ({ detail: res.statusText }));
    throw new ApiError(res.status, formatDetail(body.detail));
  }

  return res.json() as Promise<T>;
}

export async function downloadFile(
  path: string,
  filename: string,
): Promise<void> {
  const accessToken = getAccessToken();
  const url = `${API_BASE}${path}`;
  const res = await fetch(url, {
    headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : {},
  });

  if (res.status === 401) {
    const refreshed = await refreshAccessToken();
    if (refreshed) {
      return downloadFile(path, filename);
    }
  }

  if (!res.ok) {
    const body = await res.json().catch(() => ({ detail: res.statusText }));
    throw new ApiError(res.status, formatDetail(body.detail));
  }

  const blob = await res.blob();
  const objectUrl = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = objectUrl;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(objectUrl);
}

function normalizeStorageKey(pathOrKey: string): string {
  return pathOrKey.replace(/\\/g, "/").replace(/^\//, "");
}

export function resolveStorageKey(filePath: string, url?: string | null): string {
  const key = normalizeStorageKey(filePath);
  if (key.startsWith("uploads/") || key.startsWith("results/")) {
    return key;
  }
  if (url) {
    try {
      const pathname = new URL(url).pathname.replace(/^\//, "");
      if (pathname.startsWith("uploads/") || pathname.startsWith("results/")) {
        return pathname;
      }
    } catch {
      // ignore invalid URL
    }
  }
  return key;
}

export function resolveMediaProxyUrl(storageKey: string): string {
  const key = normalizeStorageKey(storageKey);
  if (!key) return "";
  return `${API_BASE}/api/media/serve/${key}`;
}

export function staticUrl(filePath: string): string {
  if (!filePath) return "";
  if (filePath.startsWith("http://") || filePath.startsWith("https://")) {
    return filePath;
  }
  const normalized = normalizeStorageKey(filePath);
  const path = normalized.startsWith("static/") ? normalized : `static/${normalized}`;
  return `${API_BASE}/${path}`;
}

export function resolveStaticUrl(filePath: string, url?: string | null): string {
  if (url?.startsWith("http://") || url?.startsWith("https://")) return url;
  if (url?.startsWith("/static/")) return `${API_BASE}${url}`;

  const key = normalizeStorageKey(filePath);
  if (
    STORAGE_PUBLIC_BASE &&
    (key.startsWith("uploads/") || key.startsWith("results/"))
  ) {
    return `${STORAGE_PUBLIC_BASE}/${key}`;
  }

  if (key.startsWith("uploads/") || key.startsWith("results/")) {
    return staticUrl(key);
  }

  return staticUrl(filePath);
}

export async function fetchAuthenticatedBlob(pathOrUrl: string): Promise<string> {
  const accessToken = getAccessToken();
  const url = pathOrUrl.startsWith("http") ? pathOrUrl : `${API_BASE}${pathOrUrl}`;
  const res = await fetch(url, {
    headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : {},
  });

  if (res.status === 401) {
    const refreshed = await refreshAccessToken();
    if (refreshed) {
      return fetchAuthenticatedBlob(pathOrUrl);
    }
    throw new ApiError(401, "Autentifikatsiya talab qilinadi");
  }

  if (!res.ok) {
    const body = await res.json().catch(() => ({ detail: res.statusText }));
    throw new ApiError(res.status, formatDetail(body.detail));
  }

  const blob = await res.blob();
  return URL.createObjectURL(blob);
}

export { API_BASE, STORAGE_PUBLIC_BASE };
