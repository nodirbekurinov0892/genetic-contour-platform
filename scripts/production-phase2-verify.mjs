/**
 * Production Phase 2 verification — login/header/footer/avatar/profile save.
 * Usage: node scripts/production-phase2-verify.mjs
 */
import { chromium } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";

const WEB = process.env.PLAYWRIGHT_BASE_URL || "https://genetic-contour-platform-web.vercel.app";
const API = process.env.PRODUCTION_API_URL || "https://genetic-contour-platform.onrender.com";
const OUT = path.resolve(process.cwd(), "production-phase2-evidence");
const MAX_WAIT_MS = 15 * 60 * 1000;
const POLL_MS = 20_000;

fs.mkdirSync(OUT, { recursive: true });

const report = {
  web: WEB,
  api: API,
  startedAt: new Date().toISOString(),
  deployWait: null,
  apiPatchFix: null,
  checks: {},
  profileSave: null,
  meAfterRefresh: null,
  screenshots: [],
};

async function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function waitForApiPatchFix() {
  const start = Date.now();
  while (Date.now() - start < MAX_WAIT_MS) {
    try {
      const email = `deploy-wait-${Date.now()}@example.com`;
      const pass = "SecurePass123!";
      const reg = await fetch(`${API}/api/auth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password: pass, name: "Deploy Wait" }),
      });
      if (!reg.ok) throw new Error(`register ${reg.status}`);
      const { access_token: token } = await reg.json();
      const patch = await fetch(`${API}/api/auth/me`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ profile: { first_name: "DeployCheck" } }),
      });
      if (patch.ok) {
        report.apiPatchFix = { ok: true, waitedMs: Date.now() - start, status: patch.status };
        return;
      }
      report.apiPatchFix = { ok: false, status: patch.status, body: await patch.text() };
    } catch (err) {
      report.apiPatchFix = { ok: false, error: String(err) };
    }
    console.log(`[wait] API patch not ready yet, retry in ${POLL_MS / 1000}s...`);
    await sleep(POLL_MS);
  }
  throw new Error("API patch fix not deployed within timeout");
}

async function waitForWebDeploy(page) {
  const start = Date.now();
  const heroMarker = "Ilmiy tajriba wizardi";
  while (Date.now() - start < MAX_WAIT_MS) {
    await page.goto(`${WEB}/login`, { waitUntil: "networkidle" });
    const html = await page.content();
    const hasHero = html.includes(heroMarker);
    const hasSkyHeaderClass = html.includes("from-sky-") || html.includes("sky-50");
    if (hasHero) {
      report.deployWait = { ok: true, waitedMs: Date.now() - start, heroMarker: true, hasSkyHeaderClass };
      return;
    }
    console.log(`[wait] Web hero not live yet, retry in ${POLL_MS / 1000}s...`);
    await sleep(POLL_MS);
  }
  throw new Error("Web deploy not detected within timeout");
}

async function main() {
  console.log("Waiting for API patch fix on Render...");
  await waitForApiPatchFix();
  console.log("API patch fix live.");

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();

  console.log("Waiting for web deploy on Vercel...");
  await waitForWebDeploy(page);
  console.log("Web deploy detected.");

  const suffix = Date.now();
  const email = `phase2-verify-${suffix}@example.com`;
  const password = "SecurePass123!";

  // Login page screenshot
  await page.goto(`${WEB}/login`, { waitUntil: "networkidle" });
  const loginShot = path.join(OUT, "01-login-hero.png");
  await page.screenshot({ path: loginShot, fullPage: true });
  report.screenshots.push(loginShot);
  report.checks.loginHero = (await page.content()).includes("Ilmiy tajriba wizardi");

  // Register + login via API for session cookies through UI login
  await fetch(`${WEB}/api/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password, name: "Phase2 Verify" }),
  });

  await page.goto(`${WEB}/login`);
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Parol").fill(password);
  await page.getByRole("button", { name: "Kirish" }).click();
  await page.waitForURL((url) => !url.pathname.includes("/login"), { timeout: 30000 });

  // Dashboard with header
  await page.waitForTimeout(1500);
  const headerShot = path.join(OUT, "02-header-sky.png");
  await page.locator("header").first().screenshot({ path: headerShot });
  report.screenshots.push(headerShot);
  const headerClass = await page.locator("header").first().getAttribute("class");
  report.checks.headerSkyBlue = Boolean(headerClass?.includes("sky"));

  // Scroll footer into view
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await page.waitForTimeout(500);
  const footerShot = path.join(OUT, "03-footer.png");
  await page.locator("footer").first().screenshot({ path: footerShot });
  report.screenshots.push(footerShot);
  report.checks.footerRedesign = (await page.locator("footer").textContent())?.includes("Hujjatlar") ?? false;

  // Profile save
  await page.goto(`${WEB}/profile`);
  await page.getByRole("button", { name: "Tahrirlash" }).first().click();
  await page.getByLabel("Ism").fill("Nodirbek");
  await page.getByLabel("Familiya").fill("Urinov");
  await page.getByLabel("Telefon raqam").fill("998901112233");
  await page.getByRole("button", { name: "Saqlash" }).first().click();
  await page.getByText("Shaxsiy ma'lumotlar saqlandi").waitFor({ timeout: 15000 });

  const profileBeforeRefresh = path.join(OUT, "04-profile-saved.png");
  await page.screenshot({ path: profileBeforeRefresh, fullPage: true });
  report.screenshots.push(profileBeforeRefresh);

  // API me before refresh
  const meBeforeRes = await page.request.get(`${WEB}/api/backend/auth/me`);
  const meBefore = await meBeforeRes.json();

  await page.reload({ waitUntil: "networkidle" });
  await page.getByText("Nodirbek").waitFor({ timeout: 10000 });
  await page.getByText("Urinov").waitFor({ timeout: 10000 });

  const profileAfterRefresh = path.join(OUT, "05-profile-after-refresh.png");
  await page.screenshot({ path: profileAfterRefresh, fullPage: true });
  report.screenshots.push(profileAfterRefresh);

  const meAfterRes = await page.request.get(`${WEB}/api/backend/auth/me`);
  const meAfter = await meAfterRes.json();

  report.profileSave = {
    uiToast: true,
    persistedAfterRefresh: {
      first_name: meAfter.profile_data?.first_name,
      last_name: meAfter.profile_data?.last_name,
      phone: meAfter.profile_data?.phone,
    },
    expected: { first_name: "Nodirbek", last_name: "Urinov", phone: "998901112233" },
    pass:
      meAfter.profile_data?.first_name === "Nodirbek" &&
      meAfter.profile_data?.last_name === "Urinov" &&
      meAfter.profile_data?.phone === "998901112233",
  };
  report.meAfterRefresh = meAfter;

  // Avatar upload — tiny PNG
  const pngBase64 =
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";
  const pngBuffer = Buffer.from(pngBase64, "base64");
  await page.goto(`${WEB}/profile`);
  await page.locator("#avatar-file").setInputFiles({
    name: "avatar.png",
    mimeType: "image/png",
    buffer: pngBuffer,
  });
  await page.getByRole("button", { name: "Saqlash" }).click();
  await page.getByText("Avatar yangilandi").waitFor({ timeout: 20000 });
  const avatarShot = path.join(OUT, "06-avatar-uploaded.png");
  await page.screenshot({ path: avatarShot, fullPage: false });
  report.screenshots.push(avatarShot);
  report.checks.avatarUpload = true;

  const meAvatarRes = await page.request.get(`${WEB}/api/backend/auth/me`);
  const meAvatar = await meAvatarRes.json();
  report.checks.avatarUrlPresent = Boolean(meAvatar.profile_data?.avatar_url);

  report.finishedAt = new Date().toISOString();
  report.meBeforeRefresh = meBefore;

  fs.writeFileSync(path.join(OUT, "report.json"), JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));

  await browser.close();
}

main().catch((err) => {
  report.error = String(err);
  fs.writeFileSync(path.join(OUT, "report.json"), JSON.stringify(report, null, 2));
  console.error(err);
  process.exit(1);
});
