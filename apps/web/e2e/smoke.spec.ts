import { test, expect } from "@playwright/test";

import { safeRedirectPath } from "../lib/safe-redirect";

test.describe("safeRedirectPath", () => {
  test("allows internal paths", () => {
    expect(safeRedirectPath("/experiments")).toBe("/experiments");
    expect(safeRedirectPath("/upload")).toBe("/upload");
  });

  test("blocks open redirects", () => {
    expect(safeRedirectPath("//evil.com")).toBe("/");
    expect(safeRedirectPath("https://evil.com")).toBe("/");
    expect(safeRedirectPath("/\\evil")).toBe("/");
  });
});

test.describe("app smoke", () => {
  test("home page loads", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  });

  test("login page loads", async ({ page }) => {
    await page.goto("/login");
    await expect(page.getByRole("heading", { name: "Sign in" })).toBeVisible();
  });

  test("protected route redirects to login without session cookie", async ({ page }) => {
    await page.goto("/experiments");
    await expect(page).toHaveURL(/\/login/);
    await expect(page.url()).toContain("next=%2Fexperiments");
  });
});
