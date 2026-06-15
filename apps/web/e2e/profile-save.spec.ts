import { test, expect } from "@playwright/test";

const isProduction =
  (process.env.PLAYWRIGHT_BASE_URL || "").includes("vercel.app");

test.describe("profile save", () => {
  test.skip(!isProduction, "Set PLAYWRIGHT_BASE_URL to production Vercel URL");

  test("login → edit profile → save → refresh persists", async ({ page, request }) => {
    const suffix = Date.now();
    const email = `profile-e2e-${suffix}@example.com`;
    const password = "SecurePass123!";
    const firstName = "E2E";
    const lastName = `User${suffix}`;

    await request.post("/api/auth/register", {
      data: { email, password, name: "Profile E2E" },
    });
    await request.post("/api/auth/login", { data: { email, password } });

    await page.goto("/login");
    await page.getByLabel("Email").fill(email);
    await page.getByLabel("Parol").fill(password);
    await page.getByRole("button", { name: "Kirish" }).click();
    await expect(page).not.toHaveURL(/\/login/);

    await page.goto("/profile");
    await expect(page.getByRole("heading", { name: "Profil", level: 2 })).toBeVisible();

    await page.getByRole("button", { name: "Tahrirlash" }).first().click();
    await page.getByLabel("Ism").fill(firstName);
    await page.getByLabel("Familiya").fill(lastName);
    await page.getByRole("button", { name: "Saqlash" }).first().click();
    await expect(page.getByText("Shaxsiy ma'lumotlar saqlandi")).toBeVisible({ timeout: 10000 });

    await page.reload();
    await expect(page.getByText(firstName)).toBeVisible();
    await expect(page.getByText(lastName)).toBeVisible();

    const meRes = await request.get("/api/backend/auth/me");
    expect(meRes.ok()).toBeTruthy();
    const me = await meRes.json();
    expect(me.profile_data?.first_name).toBe(firstName);
    expect(me.profile_data?.last_name).toBe(lastName);
  });
});
