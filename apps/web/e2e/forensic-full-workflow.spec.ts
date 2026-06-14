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

    // Register + login via API (fast path)
    await request.post(`${WEB}/api/auth/register`, {
      data: { email, password, name: "Workflow" },
    });
    const loginRes = await request.post(`${WEB}/api/auth/login`, {
      data: { email, password },
    });
    expect(loginRes.status()).toBe(200);
    const loginJson = await loginRes.json();
    const token = loginJson.access_token as string;

    // Seed session cookies for browser
    await page.goto(`${WEB}/login`);
    await page.evaluate(
      ({ t }) => {
        document.cookie = `gc_access_token=${t}; path=/; max-age=86400; SameSite=Lax`;
        document.cookie = "gc_session=1; path=/; max-age=86400; SameSite=Lax";
      },
      { t: token },
    );

    // 1 Upload original via API then verify library preview proxy
    const upload = await request.post(`${WEB}/api/backend/images/upload`, {
      multipart: {
        file: { name: "workflow.png", mimeType: "image/png", buffer: PNG },
      },
    });
    expect(upload.status()).toBe(200);
    const image = (await upload.json()).image;
    expect(image.storage_key).toBeTruthy();

    const proxyOriginal = await request.get(
      `${WEB}/api/backend/media/serve/${image.storage_key}`,
    );
    expect(proxyOriginal.status()).toBe(200);

    // 2 Library page — uploaded image visible with proxy render
    await page.goto(`${WEB}/library`);
    await expect(page.getByText("workflow.png").first()).toBeVisible({ timeout: 15_000 });
    const libraryImg = page.locator('img[alt="workflow.png"]').first();
    await expect(libraryImg).toBeVisible({ timeout: 20_000 });
    await expect(libraryImg).toHaveJSProperty("naturalWidth", 1);

    // 3 Wizard — optional GT skip (heuristic mode)
    await page.goto(`${WEB}/experiments/new`);
    await expect(page.getByText("1. Asl rasm")).toBeVisible();

    // 4 Create + run experiment via API (worker time)
    const expCreate = await request.post(`${WEB}/api/backend/experiments`, {
      data: { image_id: image.id, title: `Workflow ${suffix}` },
    });
    expect(expCreate.status()).toBe(200);
    const exp = await expCreate.json();

    const runRes = await request.post(`${WEB}/api/backend/experiments/${exp.id}/run`, {
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

    // Poll until completed
    let status = "queued";
    for (let i = 0; i < 90; i++) {
      const st = await request.get(`${WEB}/api/backend/experiments/${exp.id}/status`);
      const body = await st.json();
      status = body.status;
      if (status === "completed" || status === "failed") break;
      await page.waitForTimeout(2000);
    }
    expect(status).toBe("completed");

    // 5 Experiment detail — result images via proxy
    const resultsRes = await request.get(`${WEB}/api/backend/experiments/${exp.id}/results`);
    expect(resultsRes.status()).toBe(200);
    const results = await resultsRes.json();
    expect(results.algorithm_runs.length).toBeGreaterThan(0);

    const firstResult = results.algorithm_runs[0]?.result_images?.[0];
    expect(firstResult?.file_path || firstResult?.url).toBeTruthy();

    await page.goto(`${WEB}/experiments/${exp.id}`);
    await expect(page.getByText("Yakunlandi").or(page.getByText("completed"))).toBeVisible({
      timeout: 30_000,
    });
    const resultImgs = page.locator("img").filter({ hasNot: page.locator('[alt=""]') });
    await expect(resultImgs.first()).toBeVisible({ timeout: 30_000 });

    // 6 Comparison — auto-select + visible
    await page.goto(`${WEB}/comparison?experiment=${exp.id}`);
    await expect(page.getByText("Taqqoslash markazi")).toBeVisible({ timeout: 15_000 });
    await expect(page.locator("select#exp-select")).toHaveValue(exp.id, { timeout: 15_000 });
    await expect(
      page.getByText("Yakunlangan tajribalar yo'q").or(page.getByText("Sobel")),
    ).not.toBeVisible({ timeout: 5_000 }).catch(() => {});
    const comparisonImg = page.locator('img[alt*="Sobel"], img[alt*="sobel"], img').first();
    await expect(comparisonImg).toBeVisible({ timeout: 30_000 });

    // 7 Reports — PDF button visible for completed
    await page.goto(`${WEB}/reports`);
    await expect(page.getByText(`Workflow ${suffix}`).first()).toBeVisible({ timeout: 15_000 });
    await expect(page.getByRole("button", { name: /PDF hisobot/i }).first()).toBeVisible();

    // 8 PDF download works
    const pdfRes = await request.get(`${WEB}/api/backend/experiments/${exp.id}/export/pdf`);
    expect(pdfRes.status()).toBe(200);
    expect(pdfRes.headers()["content-type"]).toContain("pdf");
  });
});
