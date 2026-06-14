import { test, expect } from "@playwright/test";

const WEB = process.env.PLAYWRIGHT_BASE_URL || "https://genetic-contour-platform-web.vercel.app";
const isProduction = WEB.includes("vercel.app");

/**
 * Simulates exact browser StoredImage → fetchAuthenticatedBlob(resolveMediaProxyUrl(key)) URL.
 */
function browserMediaFetchUrl(storageKey: string): string {
  const API_BASE = "/api/backend";
  const proxyPath = `/media/serve/${storageKey}`;
  // Old bug: `${API_BASE}${API_BASE}/media/serve/...`
  // Fixed: toFetchUrl prepends API_BASE only when path is not already /api/*
  if (proxyPath.startsWith("/api/")) return proxyPath;
  return `${API_BASE}${proxyPath}`;
}

test.describe("forensic real user media chain", () => {
  test.skip(!isProduction, "Production forensic audit");

  test("full chain: login → upload → DB fields → proxy → GT → list", async ({
    request,
  }) => {
    const suffix = Date.now();
    const email = `forensic-${suffix}@example.com`;
    const password = "SecurePass123!";

    // 1 Login
    const reg = await request.post(`${WEB}/api/auth/register`, {
      data: { email, password, name: "Forensic" },
    });
    expect(reg.status()).toBe(200);

    const login = await request.post(`${WEB}/api/auth/login`, {
      data: { email, password },
    });
    expect(login.status()).toBe(200);

    const me = await request.get(`${WEB}/api/backend/auth/me`);
    expect(me.status()).toBe(200);

    // 2 Upload original
    const png = Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
      "base64",
    );
    const upload = await request.post(`${WEB}/api/backend/images/upload`, {
      multipart: {
        file: { name: "forensic.png", mimeType: "image/png", buffer: png },
      },
    });
    expect(upload.status()).toBe(200);
    const img = (await upload.json()).image;
    expect(img.storage_key).toMatch(/^uploads\/.+\.png$/);
    expect(img.file_path).toBe(img.storage_key);
    expect(img.url).toContain("/static/uploads/");

    // 3 Browser StoredImage exact URL (must NOT double-prefix)
    const browserUrl = browserMediaFetchUrl(img.storage_key);
    expect(browserUrl).toBe(`/api/backend/media/serve/${img.storage_key}`);
    expect(browserUrl).not.toContain("/api/backend/api/backend/");

    const proxy = await request.get(`${WEB}${browserUrl}`);
    expect(proxy.status()).toBe(200);
    expect(proxy.headers()["content-type"]).toContain("image");

    // 4 Broken legacy URL must 404
    const broken = await request.get(
      `${WEB}/api/backend/api/backend/media/serve/${img.storage_key}`,
    );
    expect(broken.status()).toBe(404);

    // 5 Direct static 404 on Render (production fact)
    const staticDirect = await request.get(img.url);
    expect(staticDirect.status()).toBe(404);

    // 6 Ground Truth upload via BFF (apiFetch path)
    const gtUpload = await request.post(
      `${WEB}/api/backend/images/${img.id}/ground-truth`,
      {
        multipart: {
          file: { name: "gt.png", mimeType: "image/png", buffer: png },
        },
      },
    );
    expect(gtUpload.status()).toBe(200);
    const withGt = (await gtUpload.json());
    expect(withGt.has_ground_truth).toBe(true);
    expect(withGt.ground_truth_url).toBeTruthy();

    // 7 GT proxy — extract key from ground_truth_url
    const gtUrl = new URL(withGt.ground_truth_url);
    const gtKey = gtUrl.pathname.replace(/^\/static\//, "");
    const gtProxy = await request.get(`${WEB}/api/backend/media/serve/${gtKey}`);
    expect(gtProxy.status()).toBe(200);

    // 8 Library list returns image
    const list = await request.get(`${WEB}/api/backend/images`);
    expect(list.status()).toBe(200);
    const images = await list.json();
    expect(images.some((i: { id: string }) => i.id === img.id)).toBe(true);
  });
});
