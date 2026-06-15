import { chromium } from "playwright";

const BASE = process.env.PRODUCTION_URL || "https://genetic-contour-platform-web.vercel.app";
const OUT = process.env.OUT_DIR || ".";

async function main() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

  await page.goto(`${BASE}/login`, { waitUntil: "networkidle" });
  const loginSidebar = await page.locator("aside").count();
  const loginNav = await page.getByText("ASOSIY").count();
  await page.screenshot({ path: `${OUT}/prod-verify-login.png`, fullPage: true });

  const suffix = Date.now();
  const email = `prod-audit-${suffix}@example.com`;
  const password = "SecurePass123!";

  await page.request.post(`${BASE}/api/auth/register`, {
    data: { email, password, name: "Prod Audit" },
  });
  await page.request.post(`${BASE}/api/auth/login`, { data: { email, password } });

  await page.goto(`${BASE}/`, { waitUntil: "networkidle" });
  await page.screenshot({ path: `${OUT}/prod-verify-dashboard.png`, fullPage: true });

  await page.goto(`${BASE}/experiments/new`, { waitUntil: "networkidle" });
  const wizardWidth = await page.locator(".max-w-\\[1320px\\]").first().boundingBox();
  const sidebarCategories = await page.getByText("ASOSIY").count();
  await page.screenshot({ path: `${OUT}/prod-verify-wizard.png`, fullPage: true });

  await page.goto(`${BASE}/experiments/new`, { waitUntil: "networkidle" });
  await page.getByRole("button", { name: /Baholash rejimiga o'tish|Algoritmlarga o'tish|Davom etish/i }).first().click({ timeout: 2000 }).catch(() => {});

  console.log(
    JSON.stringify(
      {
        base: BASE,
        login: { sidebarAsideCount: loginSidebar, asosiyNavCount: loginNav },
        wizard: { containerWidthPx: wizardWidth?.width ?? null, sidebarCategories },
        screenshots: [
          `${OUT}/prod-verify-login.png`,
          `${OUT}/prod-verify-dashboard.png`,
          `${OUT}/prod-verify-wizard.png`,
        ],
      },
      null,
      2,
    ),
  );

  await browser.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
