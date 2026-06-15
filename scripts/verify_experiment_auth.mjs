/**
 * Production metric verification with auth.
 *
 * Usage (do NOT paste password in shell history if possible — use env):
 *   set VERIFY_EMAIL=you@example.com
 *   set VERIFY_PASSWORD=your-secret
 *   node scripts/verify_experiment_auth.mjs b43cbd76-beb8-4c12-a91a-163d72abf01a
 *
 * Optional: API_URL, OUT_DIR
 */

import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const API = process.env.API_URL || "https://genetic-contour-platform.onrender.com";
const EXPERIMENT_ID = process.argv[2];
const EMAIL = process.env.VERIFY_EMAIL || process.env.PROD_EMAIL || "";
const PASSWORD = process.env.VERIFY_PASSWORD || process.env.PROD_PASSWORD || "";
const OUT_DIR =
  process.env.OUT_DIR ||
  path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "tmp", "verify-" + (EXPERIMENT_ID || "unknown"));

const EDGE_ALGOS = [
  { name: "sobel", type: "sobel", file: "sobel.png" },
  { name: "prewitt", type: "prewitt", file: "prewitt.png" },
  { name: "canny", type: "canny", file: "canny.png" },
  { name: "genetic", type: "ga", file: "genetic.png" },
];

if (!EXPERIMENT_ID) {
  console.error("Usage: node scripts/verify_experiment_auth.mjs <experiment-uuid>");
  process.exit(2);
}

if (!EMAIL || !PASSWORD) {
  console.error("ERROR: Set VERIFY_EMAIL and VERIFY_PASSWORD environment variables.");
  console.error("Note: message placeholders like MENING_EMAILIM are not valid credentials.");
  process.exit(2);
}

async function api(pathname, { token, method = "GET", body } = {}) {
  const headers = { Accept: "application/json" };
  if (token) headers.Authorization = `Bearer ${token}`;
  if (body) headers["Content-Type"] = "application/json";
  const res = await fetch(`${API}${pathname}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let json = null;
  try {
    json = JSON.parse(text);
  } catch {
    json = text;
  }
  return { res, json, text };
}

async function downloadMedia(token, storageKey, destPath) {
  const encoded = storageKey.split("/").map(encodeURIComponent).join("/");
  const res = await fetch(`${API}/api/media/serve/${encoded}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    return { ok: false, status: res.status, detail: await res.text() };
  }
  const buf = Buffer.from(await res.arrayBuffer());
  fs.mkdirSync(path.dirname(destPath), { recursive: true });
  fs.writeFileSync(destPath, buf);
  return { ok: true, bytes: buf.length };
}

function findMetric(run) {
  return run?.metrics?.[0] ?? null;
}

function findImage(run, type) {
  return run?.result_images?.find((ri) => ri.type === type) ?? null;
}

async function main() {
  console.log(`API: ${API}`);
  console.log(`Experiment: ${EXPERIMENT_ID}`);
  console.log(`Login email: ${EMAIL.replace(/(.{2}).+(@.*)/, "$1***$2")}`);

  const login = await api("/api/auth/login", {
    method: "POST",
    body: { email: EMAIL, password: PASSWORD },
  });
  if (!login.res.ok) {
    console.error(`LOGIN FAILED: HTTP ${login.res.status}`);
    console.error(JSON.stringify(login.json));
    process.exit(1);
  }
  const token = login.json?.access_token;
  if (!token) {
    console.error("LOGIN FAILED: no access_token in response");
    process.exit(1);
  }
  console.log("LOGIN OK (token redacted)");

  const results = await api(`/api/experiments/${EXPERIMENT_ID}/results`, { token });
  const insights = await api(`/api/experiments/${EXPERIMENT_ID}/insights`, { token });
  const report = await api(`/api/experiments/${EXPERIMENT_ID}/report`, { token });
  const verificationResp = await api(`/api/experiments/${EXPERIMENT_ID}/verification`, { token });

  for (const [label, resp] of [
    ["results", results],
    ["insights", insights],
    ["report", report],
  ]) {
    if (!resp.res.ok) {
      console.error(`${label.toUpperCase()} FAILED: HTTP ${resp.res.status}`);
      console.error(JSON.stringify(resp.json));
      process.exit(1);
    }
    console.log(`${label.toUpperCase()} OK`);
  }

  fs.mkdirSync(OUT_DIR, { recursive: true });
  fs.writeFileSync(path.join(OUT_DIR, "results.json"), JSON.stringify(results.json, null, 2));
  fs.writeFileSync(path.join(OUT_DIR, "insights.json"), JSON.stringify(insights.json, null, 2));
  fs.writeFileSync(path.join(OUT_DIR, "report.json"), JSON.stringify(report.json, null, 2));
  if (verificationResp.res.ok) {
    fs.writeFileSync(
      path.join(OUT_DIR, "verification.json"),
      JSON.stringify(verificationResp.json, null, 2),
    );
  }

  const imageId = results.json?.experiment?.image_id;
  const verification = verificationResp.res.ok ? verificationResp.json : null;
  const reportGt = report.json?.ground_truth_verification || report.json?.image || {};

  let gtKey =
    verification?.effective_ground_truth_key ||
    reportGt.effective_ground_truth_key ||
    reportGt.ground_truth_storage_key ||
    null;

  if (!gtKey && imageId) {
    const img = await api(`/api/images/${imageId}`, { token });
    if (img.res.ok) {
      gtKey =
        img.json?.ground_truth_storage_key ||
        img.json?.canonical_ground_truth_key ||
        null;
    }
  }

  if (!gtKey && imageId) {
    gtKey = `uploads/ground-truth/${imageId}.png`;
  }

  const inconsistencyDetected =
    verification?.inconsistency_detected ??
    report.json?.ground_truth_verification?.inconsistency_detected ??
    false;
  const gtWarning =
    verification?.warning ||
    report.json?.ground_truth_verification?.warning ||
    insights.json?.ground_truth_verification?.warning ||
    null;

  console.log("\n--- Ground truth verification ---");
  if (verificationResp.res.ok) {
    console.log(`storage_status: ${verification.ground_truth_storage_status}`);
    console.log(`file_exists: ${verification.ground_truth_file_exists}`);
    console.log(`metrics_independently_verifiable: ${verification.metrics_independently_verifiable}`);
    console.log(`inconsistency_detected: ${verification.inconsistency_detected}`);
  } else {
    console.log(`verification endpoint: HTTP ${verificationResp.res.status} (deploy latest API for full checks)`);
  }
  if (gtWarning) {
    console.log(`WARNING: ${gtWarning}`);
  }

  console.log("\n--- Storage keys ---");
  console.log(`GT effective: ${gtKey || "(none)"}`);

  const runs = results.json?.algorithm_runs ?? [];
  const edgeRuns = runs.filter((r) => EDGE_ALGOS.some((a) => a.name === r.algorithm_name));

  const artifacts = [];
  if (gtKey) {
    artifacts.push({ label: "ground_truth", key: gtKey, file: "ground_truth.png" });
  }
  for (const algo of EDGE_ALGOS) {
    const run = edgeRuns.find((r) => r.algorithm_name === algo.name);
    const ri = run ? findImage(run, algo.type) : null;
    const key = ri?.storage_key || ri?.file_path;
    console.log(`${algo.name}: ${key || "(missing)"}`);
    if (key) artifacts.push({ label: algo.name, key, file: algo.file, run });
  }

  console.log("\n--- Downloading artifacts ---");
  const missing = [];
  for (const a of artifacts) {
    const dest = path.join(OUT_DIR, a.file);
    const dl = await downloadMedia(token, a.key, dest);
    if (!dl.ok) {
      missing.push({ label: a.label, key: a.key, status: dl.status, detail: dl.detail?.slice(0, 200) });
      console.log(`MISSING ${a.label}: HTTP ${dl.status} key=${a.key}`);
    } else {
      console.log(`OK ${a.label}: ${dl.bytes} bytes -> ${dest}`);
    }
  }

  const gtPath = path.join(OUT_DIR, "ground_truth.png");
  const hasGt = fs.existsSync(gtPath);
  const gtDownloadFailed = gtKey && !hasGt;

  if (gtDownloadFailed && !missing.some((m) => m.label === "ground_truth")) {
    missing.push({
      label: "ground_truth",
      key: gtKey,
      status: "download_failed",
      detail: "GT key resolved but PNG not saved",
    });
  }

  const hasSupervisedMetrics = edgeRuns.some((r) => findMetric(r)?.iou != null);
  const ghostMetrics = hasSupervisedMetrics && !hasGt;

  if (ghostMetrics) {
    console.log(
      "\nINCONSISTENCY: supervised metrics exist in DB but GT artifact is not available for independent verification.",
    );
  }

  const pyScript = path.join(path.dirname(fileURLToPath(import.meta.url)), "verify_metrics_recompute.py");
  const recompute = spawnSync(
    process.platform === "win32" ? "python" : "python3",
    [pyScript, OUT_DIR],
    { encoding: "utf-8" },
  );
  if (recompute.status !== 0) {
    console.error(recompute.stderr || recompute.stdout);
    process.exit(recompute.status || 1);
  }
  console.log(recompute.stdout);

  const rows = JSON.parse(
    fs.readFileSync(path.join(OUT_DIR, "recomputed.json"), "utf-8"),
  );

  console.log("\n--- Difference table ---");
  console.log("algorithm | db_iou | recomputed_iou | diff_iou | db_f1 | recomputed_f1 | diff_f1 | verdict");

  let allMatch = true;
  let anyCompared = false;

  for (const algo of EDGE_ALGOS) {
    const run = edgeRuns.find((r) => r.algorithm_name === algo.name);
    const m = findMetric(run);
    const rec = rows.find((r) => r.algorithm === algo.name);
    const dbIou = m?.iou ?? null;
    const dbF1 = m?.f1_score ?? null;
    const rIou = rec?.iou ?? null;
    const rF1 = rec?.f1_score ?? null;

    let verdict = "SKIP";
    let diffIou = null;
    let diffF1 = null;

    if (!run) verdict = "NO_RUN";
    else if (ghostMetrics || inconsistencyDetected) verdict = "GT_INCONSISTENT";
    else if (!hasGt) verdict = "NO_GT";
    else if (rec?.error) verdict = rec.error;
    else if (missing.some((x) => x.label === algo.name)) verdict = "NO_ARTIFACT";
    else if (rIou != null && dbIou != null) {
      anyCompared = true;
      diffIou = Math.abs(dbIou - rIou);
      diffF1 = dbF1 != null && rF1 != null ? Math.abs(dbF1 - rF1) : null;
      const iouOk = diffIou < 1e-9;
      const f1Ok = diffF1 == null ? dbF1 == null && rF1 == null : diffF1 < 1e-9;
      verdict = iouOk && f1Ok ? "MATCH" : "MISMATCH";
      if (verdict === "MISMATCH") allMatch = false;
    }

    console.log(
      [
        algo.name,
        dbIou,
        rIou,
        diffIou,
        dbF1,
        rF1,
        diffF1,
        verdict,
      ].join(" | "),
    );
  }

  if (missing.length) {
    console.log("\n--- Missing artifacts ---");
    for (const m of missing) {
      console.log(`- ${m.label} | key=${m.key} | HTTP ${m.status}`);
    }
  }

  let finalVerdict = "B) NOT VERIFIED";
  if (ghostMetrics || inconsistencyDetected) {
    finalVerdict = "C) INVALID — GT artifact missing; stored supervised metrics cannot be independently verified";
  } else if (anyCompared && allMatch) {
    finalVerdict = "A) VERIFIED REAL";
  } else if (anyCompared && !allMatch) {
    finalVerdict = "C) INVALID — recomputed metrics do not match DB";
  }
  console.log(`\nFINAL VERDICT: ${finalVerdict}`);
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
