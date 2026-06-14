import { test, expect } from "@playwright/test";

const WEB = process.env.PLAYWRIGHT_BASE_URL || "https://genetic-contour-platform-web.vercel.app";
const isProduction = WEB.includes("vercel.app");

const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64",
);

test.describe("forensic full user workflow", () => {
  test.skip(!isProduction, "Production forensic audit");
  test.setTimeout(300_000);

  test("login → upload → preview → experiment → comparison → report", async ({
    page,
    request,
  }) => {
    const suffix = Date.now();
    const email = `workflow-${suffix}@example.com`;
    const password = "SecurePass123!";

    // Register via API, then UI login (sets HttpOnly gc_access_token cookie)
    const reg = await request.post(`${WEB}/api/auth/register`, {
      data: { email, password, name: "Workflow" },
    });
    expect(reg.status()).toBe(200);

    await page.goto(`${WEB}/login`);
    await page.getByLabel("Email").fill(email);
    await page.getByLabel("Parol").fill(password);
    await page.getByRole("button", { name: "Kirish" }).click();
    await expect(page).not.toHaveURL(/\/login/, { timeout: 15_000 });

    const api = page.request;

    // 1 Upload original — same browser cookie jar as UI
    const upload = await api.post(`${WEB}/api/backend/images/upload`, {
      multipart: {
        file: { name: "workflow.png", mimeType: "image/png", buffer: PNG },
      },
    });
    expect(upload.status()).toBe(200);
    const image = (await upload.json()).image;
    expect(image.storage_key).toBeTruthy();

    const proxyOriginal = await api.get(`${WEB}/api/backend/media/serve/${image.storage_key}`);
    expect(proxyOriginal.status()).toBe(200);

    // 2 Library page — uploaded image visible with proxy render
    await page.goto(`${WEB}/library`);
    await expect(page.getByText("workflow.png").first()).toBeVisible({ timeout: 20_000 });
    const libraryImg = page.locator('img[alt="workflow.png"]').first();
    await expect(libraryImg).toBeVisible({ timeout: 30_000 });
    await expect(libraryImg).toHaveJSProperty("naturalWidth", 1);

    // 3 Wizard reachable
    await page.goto(`${WEB}/experiments/new`);
    await expect(page.getByRole("heading", { name: "1. Asl rasm yuklash" })).toBeVisible();

    // 4 Create + run experiment
    const expCreate = await api.post(`${WEB}/api/backend/experiments`, {
      data: { image_id: image.id, title: `Workflow ${suffix}` },
    });
    expect(expCreate.status()).toBe(200);
    const exp = await expCreate.json();

    const runRes = await api.post(`${WEB}/api/backend/experiments/${exp.id}/run`, {
      data: {
        algorithm: "compare_all",
        params: {
          gaussian_kernel: 5,
          gaussian_sigma: 1.0,
          canny_low: 50,
          canny_high: 150,
          sobel_ksize: 3,
        },
        ga_params: {
          population_size: 20,
          generations: 5,
          mutation_rate: 0.1,
          crossover_rate: 0.8,
        },
        comparison_protocol: "fair_v1",
      },
    });
    expect(runRes.status()).toBe(200);

    let status = "queued";
    for (let i = 0; i < 90; i++) {
      const st = await api.get(`${WEB}/api/backend/experiments/${exp.id}/status`);
      const body = await st.json();
      status = body.status;
      if (status === "completed" || status === "failed") break;
      await page.waitForTimeout(2000);
    }
    expect(status).toBe("completed");

    // 5 Experiment detail — result images via proxy
    const resultsRes = await api.get(`${WEB}/api/backend/experiments/${exp.id}/results`);
    expect(resultsRes.status()).toBe(200);
    const results = await resultsRes.json();
    expect(results.algorithm_runs.length).toBeGreaterThan(0);

    await page.goto(`${WEB}/experiments/${exp.id}`);
    await expect(page.getByRole("button", { name: "PDF hisobot" })).toBeVisible({
      timeout: 60_000,
    });
    const resultImgs = page.locator("img").filter({ hasNot: page.locator('[alt=""]') });
    await expect(resultImgs.first()).toBeVisible({ timeout: 30_000 });

    // 6 Comparison — auto-select completed experiment
    await page.goto(`${WEB}/comparison?experiment=${exp.id}`);
    await expect(page.getByText("Taqqoslash markazi")).toBeVisible({ timeout: 15_000 });
    await expect(page.locator("select#exp-select")).toHaveValue(exp.id, { timeout: 15_000 });
    await expect(page.getByText("Sobel").first()).toBeVisible({ timeout: 30_000 });

    // 7 Reports — PDF button visible for completed experiment
    await page.goto(`${WEB}/reports`);
    await expect(page.getByText(`Workflow ${suffix}`).first()).toBeVisible({ timeout: 15_000 });
    await expect(page.getByRole("button", { name: /PDF hisobot/i }).first()).toBeVisible();

    const pdfRes = await api.get(`${WEB}/api/backend/experiments/${exp.id}/report/pdf`);
    expect(pdfRes.status()).toBe(200);
    expect(pdfRes.headers()["content-type"]).toContain("pdf");
  });
});
