import { test, expect } from "@playwright/test";

const isProduction =
  (process.env.PLAYWRIGHT_BASE_URL || "").includes("vercel.app");

test.describe("auth flow", () => {
  test.skip(!isProduction, "Set PLAYWRIGHT_BASE_URL to production Vercel URL");

  test("register → login → /me → dashboard", async ({ page, request }) => {
    const suffix = Date.now();
    const email = `auth-e2e-${suffix}@example.com`;
    const password = "SecurePass123!";

    const registerRes = await request.post("/api/auth/register", {
      data: { email, password, name: "Auth E2E" },
    });
    expect(registerRes.ok()).toBeTruthy();

    const loginRes = await request.post("/api/auth/login", {
      data: { email, password },
    });
    expect(loginRes.ok()).toBeTruthy();

    const meRes = await request.get("/api/backend/auth/me");
    expect(meRes.ok()).toBeTruthy();
    const me = await meRes.json();
    expect(me.email).toBe(email);

    await page.goto("/login");
    await page.getByLabel("Email").fill(email);
    await page.getByLabel("Parol").fill(password);
    await page.getByRole("button", { name: "Kirish" }).click();

    await expect(page).not.toHaveURL(/\/login/);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  });
});
