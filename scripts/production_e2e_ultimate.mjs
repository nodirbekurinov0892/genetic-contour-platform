/**
 * Production E2E — Phase Ultimate finalization
 * Run: node scripts/production_e2e_ultimate.mjs
 */
const API = process.env.API_URL || "https://genetic-contour-platform.onrender.com";
const WEB = process.env.WEB_URL || "https://genetic-contour-platform-web.vercel.app";

const results = [];

function record(check, expected, actual, evidence, verdict) {
  results.push({ check, expected, actual, evidence, verdict });
  console.log(`${verdict} | ${check}`);
}

async function api(path, opts = {}) {
  const res = await fetch(`${API}${path}`, opts);
  const text = await res.text();
  let json = null;
  try {
    json = JSON.parse(text);
  } catch {
    json = text;
  }
  return { res, json, text };
}

async function main() {
  const suffix = Date.now();
  const email = `ultimate-e2e-${suffix}@example.com`;
  const password = "SecurePass123!";

  // Health
  {
    const { res, json } = await api("/health");
    record("API /health", "200 ok", `${res.status} ${json?.status}`, API, res.ok ? "PASS" : "FAIL");
  }
  {
    const { res, json } = await api("/health/ready");
    record(
      "API /health/ready",
      "200 or 503 checks",
      `${res.status} ${json?.status}`,
      JSON.stringify(json?.checks ?? {}),
      res.status === 200 || res.status === 503 ? "PASS" : "FAIL",
    );
  }

  // OpenAPI new routes
  {
    const { res, text } = await api("/openapi.json");
    const paths = ["/api/ground-truth", "/api/benchmarks", "/api/lifecycle", "/api/auth/config"];
    const found = paths.filter((p) => text.includes(p));
    record(
      "OpenAPI new routes",
      paths.join(", "),
      found.join(", "),
      `${found.length}/${paths.length}`,
      found.length === paths.length ? "PASS" : "FAIL",
    );
  }

  // Auth config degraded
  {
    const { res, json } = await api("/api/auth/config");
    record(
      "SMTP degraded config",
      "degraded_auth_mode field",
      String(json?.degraded_auth_mode),
      JSON.stringify(json),
      res.ok && "degraded_auth_mode" in json ? "PASS" : "FAIL",
    );
  }

  // BFF auth (browser → Vercel → Render)
  {
    const bffSuffix = Date.now();
    const bffEmail = `bff-e2e-${bffSuffix}@example.com`;
    const bffPassword = "SecurePass123!";
    const reg = await fetch(`${WEB}/api/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: bffEmail, password: bffPassword, name: "BFF E2E" }),
    });
    record("BFF register", "200", String(reg.status), bffEmail, reg.ok ? "PASS" : "FAIL");

    const login = await fetch(`${WEB}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: bffEmail, password: bffPassword }),
    });
    const setCookies = typeof login.headers.getSetCookie === "function"
      ? login.headers.getSetCookie()
      : [];
    const cookieHeader = setCookies.map((c) => c.split(";")[0]).join("; ");
    record("BFF login", "200", String(login.status), bffEmail, login.ok ? "PASS" : "FAIL");

    const me = await fetch(`${WEB}/api/backend/auth/me`, {
      headers: cookieHeader ? { Cookie: cookieHeader } : {},
    });
    const meOk = me.ok;
    record("BFF /me", "200", String(me.status), meOk ? "profile ok" : await me.text(), meOk ? "PASS" : "FAIL");

    const dash = await fetch(`${WEB}/`);
    record("WEB dashboard /", "200", String(dash.status), WEB, dash.ok ? "PASS" : "FAIL");
  }

  // Register + login (direct API)
  let accessToken = "";
  {
    const { res, json } = await api("/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password, name: "E2E" }),
    });
    accessToken = json?.access_token || "";
    record("Register", "200 + token", `${res.status}`, accessToken ? "token ok" : json, res.ok ? "PASS" : "FAIL");
  }
  {
    const { res } = await api("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    record("Login", "200", String(res.status), email, res.ok ? "PASS" : "FAIL");
  }

  const auth = { Authorization: `Bearer ${accessToken}` };

  // Web routes
  const webRoutes = [
    "/ground-truth",
    "/benchmarks",
    "/help",
    "/onboarding",
    "/legal/terms",
    "/legal/privacy",
    "/legal/cookies",
  ];
  for (const route of webRoutes) {
    const res = await fetch(`${WEB}${route}`);
    record(`WEB ${route}`, "200", String(res.status), WEB + route, res.ok ? "PASS" : "FAIL");
  }

  // Upload image (minimal 1x1 PNG without canvas dep — use built-in)
  let imageId = "";
  {
    const png = Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
      "base64",
    );
    const form = new FormData();
    form.append("file", new Blob([png], { type: "image/png" }), "e2e.png");
    const res = await fetch(`${API}/api/images/upload`, { method: "POST", headers: auth, body: form });
    const json = await res.json();
    imageId = json?.image?.id || "";
    record("Upload image", "200 + id", `${res.status}`, imageId, res.ok && imageId ? "PASS" : "FAIL");
  }

  // GT upload
  {
    const png = Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
      "base64",
    );
    const form = new FormData();
    form.append("file", new Blob([png], { type: "image/png" }), "gt.png");
    const res = await fetch(`${API}/api/images/${imageId}/ground-truth`, {
      method: "POST",
      headers: auth,
      body: form,
    });
    const json = await res.json();
    record(
      "GT upload",
      "gt_validation_status",
      json?.gt_validation_status || String(res.status),
      JSON.stringify({ status: json?.gt_validation_status }),
      res.ok ? "PASS" : "FAIL",
    );
  }

  // GT manager visible
  {
    const { res, json } = await api("/api/ground-truth/coverage", { headers: auth });
    record("GT coverage API", "200", String(res.status), JSON.stringify(json), res.ok ? "PASS" : "FAIL");
  }

  // Experiment compare_all fair_v1
  let experimentId = "";
  {
    const { res, json } = await api("/api/experiments", {
      method: "POST",
      headers: { ...auth, "Content-Type": "application/json" },
      body: JSON.stringify({ image_id: imageId, title: `E2E ${suffix}` }),
    });
    experimentId = json?.id || "";
    record("Create experiment", "200", String(res.status), experimentId, res.ok ? "PASS" : "FAIL");
  }
  {
    const { res } = await api(`/api/experiments/${experimentId}/run`, {
      method: "POST",
      headers: { ...auth, "Content-Type": "application/json" },
      body: JSON.stringify({
        algorithm: "compare_all",
        params: { threshold: 0.5, blur_kernel: 5, resize_width: 64, canny_low: 50, canny_high: 150 },
        ga_params: { population_size: 10, generations: 5, mutation_rate: 0.05, crossover_rate: 0.7, elitism_count: 1 },
        comparison_protocol: "fair_v1",
      }),
    });
    record("Run compare_all fair_v1", "200 queued", String(res.status), experimentId, res.ok ? "PASS" : "FAIL");
  }

  // Poll completion (max 120s)
  let completed = false;
  for (let i = 0; i < 60; i++) {
    await new Promise((r) => setTimeout(r, 2000));
    const { res, json } = await api(`/api/experiments/${experimentId}/status`, { headers: auth });
    if (json?.status === "completed") {
      completed = true;
      break;
    }
    if (json?.status === "failed") break;
  }
  record("Experiment completed", "completed", completed ? "completed" : "timeout/failed", experimentId, completed ? "PASS" : "FAIL");

  if (completed) {
    const { res, json } = await api(`/api/experiments/${experimentId}`, { headers: auth });
    record(
      "fair_v1 on experiment",
      "fair_v1",
      json?.comparison_protocol || "null",
      experimentId,
      json?.comparison_protocol === "fair_v1" ? "PASS" : "FAIL",
    );
    const pdf = await fetch(`${API}/api/experiments/${experimentId}/report/pdf`, { headers: auth });
    const pdfCt = pdf.headers.get("content-type") || "";
    record(
      "PDF v3 download",
      "200 application/pdf",
      `${pdf.status} ${pdfCt}`,
      `bytes=${pdf.headers.get("content-length")}`,
      pdf.ok && pdfCt.includes("pdf") ? "PASS" : "FAIL",
    );
  }

  // Benchmark create + run
  {
    const { res, json } = await api("/api/benchmarks", {
      method: "POST",
      headers: { ...auth, "Content-Type": "application/json" },
      body: JSON.stringify({
        slug: `e2e-${suffix}`,
        name: `E2E Benchmark ${suffix}`,
        description: "Production E2E",
        image_ids: imageId ? [imageId] : [],
      }),
    });
    const benchId = json?.id;
    record("Benchmark create", "200", String(res.status), benchId || JSON.stringify(json), res.ok && benchId ? "PASS" : "FAIL");
    if (benchId) {
      const runRes = await api(`/api/benchmarks/${benchId}/runs`, {
        method: "POST",
        headers: { ...auth, "Content-Type": "application/json" },
        body: JSON.stringify({
          algorithm: "compare_all",
          params: { threshold: 0.5, blur_kernel: 5, resize_width: 64, canny_low: 50, canny_high: 150 },
          ga_params: { population_size: 10, generations: 5 },
          comparison_protocol: "fair_v1",
        }),
      });
      record("Benchmark run start", "200", String(runRes.res.status), JSON.stringify(runRes.json), runRes.res.ok ? "PASS" : "FAIL");
    }
  }

  const failed = results.filter((r) => r.verdict === "FAIL");
  console.log("\n=== SUMMARY ===");
  console.log(`PASS: ${results.length - failed.length}/${results.length}`);
  if (failed.length) {
    console.log("FAILURES:", failed.map((f) => f.check).join(", "));
    process.exit(1);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
