#!/usr/bin/env python3
"""Recompute supervised metrics from downloaded PNG artifacts."""

from __future__ import annotations

import json
import sys
from pathlib import Path

import cv2
import numpy as np

# Allow import from apps/api when run from scripts/
ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "apps" / "api"))

from app.core.supervised_metrics import _binarize, align_ground_truth, compute_supervised_metrics  # noqa: E402

ALGOS = [
    ("sobel", "sobel.png"),
    ("prewitt", "prewitt.png"),
    ("canny", "canny.png"),
    ("genetic", "genetic.png"),
]


def load_gray(path: Path) -> np.ndarray | None:
    data = path.read_bytes()
    arr = cv2.imdecode(np.frombuffer(data, dtype=np.uint8), cv2.IMREAD_GRAYSCALE)
    return arr


def counts(pred: np.ndarray, gt: np.ndarray) -> dict[str, int]:
    p = _binarize(pred)
    g = align_ground_truth(gt, p.shape[:2])
    return {
        "tp": int(np.sum(p & g)),
        "fp": int(np.sum(p & ~g)),
        "fn": int(np.sum(~p & g)),
    }


def main() -> int:
    if len(sys.argv) != 2:
        print("Usage: verify_metrics_recompute.py <artifact_dir>", file=sys.stderr)
        return 2

    out_dir = Path(sys.argv[1])
    gt_path = out_dir / "ground_truth.png"
    gt = load_gray(gt_path) if gt_path.exists() else None

    rows = []
    for algo, filename in ALGOS:
        edge_path = out_dir / filename
        row: dict = {"algorithm": algo}
        if not edge_path.exists():
            row["error"] = "NO_ARTIFACT"
            rows.append(row)
            continue
        if gt is None:
            row["error"] = "NO_GT"
            rows.append(row)
            continue
        edges = load_gray(edge_path)
        if edges is None:
            row["error"] = "DECODE_FAILED"
            rows.append(row)
            continue
        metrics = compute_supervised_metrics(edges, gt)
        row.update(metrics)
        row.update(counts(edges, gt))
        rows.append(row)

    (out_dir / "recomputed.json").write_text(json.dumps(rows, indent=2), encoding="utf-8")
    print(json.dumps(rows, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
