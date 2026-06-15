const API = "https://genetic-contour-platform.onrender.com";
const suffix = Date.now();
const email = `pdf-dbg-${suffix}@example.com`;
const password = "SecurePass123!";

async function api(path, opts = {}) {
  const res = await fetch(`${API}${path}`, opts);
  const text = await res.text();
  let json = null;
  try { json = JSON.parse(text); } catch { json = text; }
  return { res, json, text };
}

const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==", "base64");
const form = new FormData();
form.append("file", new Blob([png], { type: "image/png" }), "test.png");

const { json: reg } = await api("/api/auth/register", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ email, password, name: "PDF" }),
});
const { json: login } = await api("/api/auth/login", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ email, password }),
});
const auth = { Authorization: `Bearer ${login.access_token}` };

const imgRes = await fetch(`${API}/api/images/upload`, { method: "POST", headers: auth, body: form });
const imgJson = await imgRes.json();
const imageId = imgJson?.image?.id;
console.log("image", imgRes.status, imageId);

const gtForm = new FormData();
gtForm.append("file", new Blob([png], { type: "image/png" }), "gt.png");
const gtRes = await fetch(`${API}/api/images/${imageId}/ground-truth`, { method: "POST", headers: auth, body: gtForm });
console.log("gt", gtRes.status, await gtRes.text());

const { res: expRes, json: exp } = await api("/api/experiments", {
  method: "POST",
  headers: { ...auth, "Content-Type": "application/json" },
  body: JSON.stringify({ image_id: imageId, title: `PDF ${suffix}` }),
});
console.log("create exp", expRes.status, exp.id);

await api(`/api/experiments/${exp.id}/run`, {
  method: "POST",
  headers: { ...auth, "Content-Type": "application/json" },
  body: JSON.stringify({
    algorithm: "compare_all",
    params: { threshold: 0.5, blur_kernel: 5, resize_width: 64, canny_low: 50, canny_high: 150 },
    ga_params: { population_size: 10, generations: 5, mutation_rate: 0.05, crossover_rate: 0.7, elitism_count: 1 },
    comparison_protocol: "fair_v1",
  }),
});

for (let i = 0; i < 60; i++) {
  await new Promise((r) => setTimeout(r, 2000));
  const { json: st } = await api(`/api/experiments/${exp.id}/status`, { headers: auth });
  if (st.status === "completed" || st.status === "failed") {
    console.log("status", st.status);
    break;
  }
}

const pdf = await fetch(`${API}/api/experiments/${exp.id}/report/pdf`, { headers: auth });
console.log("PDF", pdf.status, pdf.headers.get("content-type"), pdf.headers.get("content-length"));
const body = await pdf.text();
console.log("body preview", body.slice(0, 500));
