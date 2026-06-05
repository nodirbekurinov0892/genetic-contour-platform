import { getAccessToken, getRefreshToken, setTokens, clearTokens } from "@/lib/auth-storage";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

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
  return "Request failed";
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
  const url = `${API_BASE}${path}`;
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

export function staticUrl(filePath: string): string {
  if (!filePath) return "";
  if (filePath.startsWith("http://") || filePath.startsWith("https://")) {
    return filePath;
  }
  const normalized = filePath.replace(/\\/g, "/").replace(/^\//, "");
  const path = normalized.startsWith("static/") ? normalized : `static/${normalized}`;
  return `${API_BASE}/${path}`;
}

export function resolveStaticUrl(filePath: string, url?: string | null): string {
  if (url?.startsWith("http://") || url?.startsWith("https://")) return url;
  if (url?.startsWith("/static/")) return `${API_BASE}${url}`;
  return staticUrl(filePath);
}

export { API_BASE };
