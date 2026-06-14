const PRODUCTION_API = "https://genetic-contour-platform.onrender.com";
const BACKEND_TIMEOUT_MS = 25_000;
const MAX_ATTEMPTS = 3;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Backend base URL for Vercel route handlers (server-side only). */
export function getBackendApiBase(): string {
  const configured = (process.env.NEXT_PUBLIC_API_URL || "").replace(/\/$/, "");
  if (configured && !configured.includes("localhost")) {
    return configured;
  }
  if (process.env.NODE_ENV === "production") {
    return PRODUCTION_API;
  }
  return configured || "http://localhost:8000";
}

export async function fetchBackend(
  path: string,
  init?: RequestInit,
): Promise<Response> {
  const base = getBackendApiBase();
  const url = path.startsWith("http")
    ? path
    : `${base}${path.startsWith("/") ? path : `/${path}`}`;

  let lastError: unknown;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), BACKEND_TIMEOUT_MS);
    try {
      const res = await fetch(url, { ...init, signal: controller.signal });
      clearTimeout(timer);
      if ([502, 503, 504].includes(res.status) && attempt < MAX_ATTEMPTS) {
        await sleep(2000 * attempt);
        continue;
      }
      return res;
    } catch (err) {
      clearTimeout(timer);
      lastError = err;
      if (attempt < MAX_ATTEMPTS) {
        await sleep(2000 * attempt);
      }
    }
  }
  throw lastError ?? new Error("Backend unreachable");
}

export async function parseBackendJson(res: Response): Promise<Record<string, unknown>> {
  const text = await res.text();
  try {
    const parsed = JSON.parse(text) as unknown;
    if (parsed && typeof parsed === "object") {
      return parsed as Record<string, unknown>;
    }
  } catch {
    // non-JSON (e.g. Render HTML error page)
  }
  return {
    detail:
      text.trim().slice(0, 200) ||
      `Backend javob bermadi (HTTP ${res.status})`,
  };
}

export function bffNetworkErrorDetail(err: unknown): string {
  if (err instanceof Error) {
    if (err.name === "AbortError") {
      return (
        "API server javob bermadi (timeout). Render uyqudan uyg'onayotgan bo'lishi mumkin — " +
        "30 soniya kutib qayta urinib ko'ring."
      );
    }
    if (err.message.includes("fetch failed") || err.message.includes("ECONNREFUSED")) {
      return (
        "API serverga ulanib bo'lmadi. Vercel env NEXT_PUBLIC_API_URL=" +
        "https://genetic-contour-platform.onrender.com ekanligini tekshiring."
      );
    }
  }
  return (
    "Server bilan bog'lanib bo'lmadi. Internet aloqasini tekshiring yoki biroz kutib qayta urinib ko'ring."
  );
}
