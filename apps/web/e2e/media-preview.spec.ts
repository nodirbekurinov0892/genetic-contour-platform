import { test, expect } from "@playwright/test";

const isProduction =
  (process.env.PLAYWRIGHT_BASE_URL || "").includes("vercel.app");

test.describe("media preview flow", () => {
  test.skip(!isProduction, "Set PLAYWRIGHT_BASE_URL to production Vercel URL");

  test("upload image → preview via BFF media proxy", async ({ page, request }) => {
    const suffix = Date.now();
    const email = `media-e2e-${suffix}@example.com`;
    const password = "SecurePass123!";

    await request.post("/api/auth/register", {
      data: { email, password, name: "Media E2E" },
    });
    await request.post("/api/auth/login", { data: { email, password } });

    const png = Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
      "base64",
    );

    const uploadRes = await request.post("/api/backend/images/upload", {
      multipart: {
        file: {
          name: "e2e.png",
          mimeType: "image/png",
          buffer: png,
        },
      },
    });
    expect(uploadRes.ok()).toBeTruthy();
    const uploadJson = await uploadRes.json();
    const storageKey = uploadJson.image.storage_key as string;
    expect(storageKey).toMatch(/^uploads\//);

    const proxyRes = await request.get(`/api/backend/media/serve/${storageKey}`);
    expect(proxyRes.status()).toBe(200);
    expect(proxyRes.headers()["content-type"]).toContain("image");

    const brokenProxy = await request.get(`/api/backend/api/media/serve/${storageKey}`);
    expect(brokenProxy.status()).toBe(404);

    await page.goto("/login");
    await page.getByLabel("Email").fill(email);
    await page.getByLabel("Parol").fill(password);
    await page.getByRole("button", { name: "Kirish" }).click();
    await expect(page).not.toHaveURL(/\/login/);

    await page.goto("/experiments/new");
    await expect(page.getByRole("heading", { name: /Yangi tajriba/i })).toBeVisible();
  });
});
