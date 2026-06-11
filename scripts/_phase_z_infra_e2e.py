"""Phase Z+ infra E2E verification against production API."""

from __future__ import annotations

import io
import json
import sys
import time
import uuid
from urllib.parse import urlparse

import requests
from PIL import Image, ImageDraw

API = "https://genetic-contour-platform.onrender.com"
FRONTEND_URLS = [
    "https://genetic-contour-platform.vercel.app",
    "https://genetic-contour.vercel.app",
]
TIMEOUT = 180
REQUEST_TIMEOUT = 90


def make_png(kind: str) -> bytes:
    img = Image.new("RGB", (128, 128), color=(240, 240, 240))
    draw = ImageDraw.Draw(img)
    if kind == "geo":
        draw.rectangle([20, 20, 108, 108], outline=(0, 0, 0), width=3)
        draw.line([20, 64, 108, 64], fill=(0, 0, 0), width=2)
    elif kind == "obj":
        draw.ellipse([30, 30, 98, 98], fill=(80, 120, 200), outline=(0, 0, 0))
    else:
        for i in range(0, 128, 8):
            draw.line([0, i, 128, i], fill=(i * 2 % 255, 50, 100), width=1)
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    return buf.getvalue()


def wait_experiment(token: str, exp_id: str) -> dict:
    headers = {"Authorization": f"Bearer {token}"}
    deadline = time.time() + TIMEOUT
    while time.time() < deadline:
        r = _get(f"{API}/api/experiments/{exp_id}", headers=headers)
        r.raise_for_status()
        data = r.json()
        status = data.get("status")
        if status in {"completed", "failed", "cancelled"}:
            return data
        time.sleep(2)
    raise TimeoutError(f"Experiment {exp_id} not finished in {TIMEOUT}s")


def _get(url: str, **kwargs) -> requests.Response:
    kwargs.setdefault("timeout", REQUEST_TIMEOUT)
    for attempt in range(3):
        try:
            return requests.get(url, **kwargs)
        except requests.RequestException:
            if attempt == 2:
                raise
            time.sleep(5)
    raise RuntimeError("unreachable")


def _post(url: str, **kwargs) -> requests.Response:
    kwargs.setdefault("timeout", REQUEST_TIMEOUT)
    for attempt in range(3):
        try:
            return requests.post(url, **kwargs)
        except requests.RequestException:
            if attempt == 2:
                raise
            time.sleep(5)
    raise RuntimeError("unreachable")


def main() -> int:
    results: dict[str, str] = {}
    email = f"infra.{uuid.uuid4().hex[:10]}@gmail.com"
    password = "AuditPass123!"

    # Warm up Render (cold start)
    try:
        _get(f"{API}/health")
    except requests.RequestException:
        results["warmup"] = "WARNING"

    # Health
    for path in ("/health", "/health/ready", "/docs", "/openapi.json"):
        r = _get(f"{API}{path}")
        results[f"health{path}"] = "PASS" if r.status_code == 200 else "FAIL"

    # Auth
    reg = _post(
        f"{API}/api/auth/register",
        json={"email": email, "password": password, "full_name": "Infra E2E"},
    )
    results["auth_register"] = "PASS" if reg.status_code == 200 else "FAIL"
    token = reg.json().get("access_token", "")
    headers = {"Authorization": f"Bearer {token}"}

    me = _get(f"{API}/api/auth/me", headers=headers)
    results["auth_me"] = "PASS" if me.status_code == 200 else "FAIL"

    # Upload
    files = {"file": ("geo.png", make_png("geo"), "image/png")}
    up = _post(f"{API}/api/images/upload", headers=headers, files=files)
    results["upload"] = "PASS" if up.status_code == 200 else "FAIL"
    image_payload = up.json().get("image", {})
    image_id = image_payload.get("id")
    upload_url = image_payload.get("url", "")

    # compare_all without GT
    cr = _post(
        f"{API}/api/experiments",
        headers=headers,
        json={"title": "Infra E2E no GT", "image_id": image_id},
    )
    results["compare_no_gt_create"] = "PASS" if cr.status_code in (200, 201) else "FAIL"
    exp_id = cr.json().get("id")
    run = _post(
        f"{API}/api/experiments/{exp_id}/run",
        headers=headers,
        json={"algorithm": "compare_all"},
    )
    results["compare_no_gt_run"] = "PASS" if run.status_code == 200 else "FAIL"
    exp = wait_experiment(token, exp_id)
    results["compare_no_gt_completed"] = "PASS" if exp.get("status") == "completed" else "FAIL"

    rep = _get(f"{API}/api/experiments/{exp_id}/report", headers=headers)
    sci = rep.json().get("scientific_evaluation", {}) if rep.status_code == 200 else {}
    results["compare_no_gt_mode_heuristic"] = (
        "PASS" if sci.get("evaluation_mode") == "heuristic" else "FAIL"
    )
    results["compare_no_gt_winner_null"] = "PASS" if sci.get("winner") is None else "FAIL"

    # Result URL check
    res = _get(f"{API}/api/experiments/{exp_id}/results", headers=headers)
    result_url = ""
    runs_data = res.json().get("algorithm_runs", []) if res.status_code == 200 else []
    for run_item in runs_data:
        for img in run_item.get("result_images", []):
            if img.get("url"):
                result_url = img.get("url", "")
                break
        if result_url:
            break
    parsed = urlparse(result_url)
    localhost_url = "localhost" in (result_url or "").lower()
    if result_url and not localhost_url:
        url_ok = requests.head(result_url, timeout=20).status_code in (200, 301, 302, 403)
        results["result_public_url"] = "PASS" if url_ok else "WARNING"
    elif result_url and localhost_url:
        results["result_public_url"] = "FAIL"
        # media proxy fallback
        sk = None
        for run_item in runs_data:
            for img in run_item.get("result_images", []):
                sk = img.get("storage_key")
                if sk:
                    break
            if sk:
                break
        if sk:
            media = _get(f"{API}/api/media/serve/{sk}", headers=headers)
            results["result_media_proxy"] = "PASS" if media.status_code == 200 else "FAIL"
    else:
        results["result_public_url"] = "FAIL"

    # GT upload + compare_all
    gt_files = {"file": ("gt.png", make_png("geo"), "image/png")}
    gt = _post(
        f"{API}/api/images/{image_id}/ground-truth",
        headers=headers,
        files=gt_files,
    )
    results["gt_upload"] = "PASS" if gt.status_code == 200 else "FAIL"

    cr2 = _post(
        f"{API}/api/experiments",
        headers=headers,
        json={"title": "Infra E2E with GT", "image_id": image_id},
    )
    exp2_id = cr2.json().get("id")
    run2 = _post(
        f"{API}/api/experiments/{exp2_id}/run",
        headers=headers,
        json={"algorithm": "compare_all"},
    )
    results["compare_gt_run"] = "PASS" if run2.status_code == 200 else "FAIL"
    exp2 = wait_experiment(token, exp2_id)
    results["compare_gt_completed"] = "PASS" if exp2.get("status") == "completed" else "FAIL"

    rep2 = _get(f"{API}/api/experiments/{exp2_id}/report", headers=headers)
    sci2 = rep2.json().get("scientific_evaluation", {}) if rep2.status_code == 200 else {}
    results["compare_gt_mode_supervised"] = (
        "PASS" if sci2.get("evaluation_mode") == "supervised" else "FAIL"
    )
    metrics = rep2.json().get("metrics", []) if rep2.status_code == 200 else []
    has_iou = any(m.get("iou") is not None for m in metrics)
    results["compare_gt_iou_present"] = "PASS" if has_iou else "FAIL"

    # GT edge case: old no-GT report after GT added
    rep_old = _get(f"{API}/api/experiments/{exp_id}/report", headers=headers)
    sci_old = rep_old.json().get("scientific_evaluation", {}) if rep_old.status_code == 200 else {}
    edge_ok = (
        sci_old.get("evaluation_mode") == "heuristic"
        and sci_old.get("has_ground_truth") is False
        and sci_old.get("winner") is None
    )
    results["gt_edge_old_report_stays_heuristic"] = "PASS" if edge_ok else "FAIL"

    # Exports on GT experiment
    for kind, path in (
        ("json", f"/api/experiments/{exp2_id}/report"),
        ("csv", f"/api/experiments/{exp2_id}/report/csv"),
        ("pdf", f"/api/experiments/{exp2_id}/report/pdf"),
    ):
        er = _get(f"{API}{path}", headers=headers)
        if kind == "pdf":
            ok = er.status_code == 200 and er.content[:4] == b"%PDF"
        else:
            ok = er.status_code == 200
        results[f"export_{kind}"] = "PASS" if ok else "FAIL"

    # Frontend
    fe_ok = False
    for url in FRONTEND_URLS:
        try:
            fr = requests.get(url, timeout=15)
            if fr.status_code == 200 and "html" in fr.headers.get("content-type", "").lower():
                fe_ok = True
                break
        except requests.RequestException:
            pass
    results["frontend"] = "PASS" if fe_ok else "FAIL"

    print(json.dumps({"api": API, "email": email, "exp_no_gt": exp_id, "exp_gt": exp2_id, "upload_url": upload_url, "result_url": result_url, "results": results}, indent=2))
    fails = [k for k, v in results.items() if v == "FAIL"]
    return 1 if fails else 0


if __name__ == "__main__":
    sys.exit(main())
