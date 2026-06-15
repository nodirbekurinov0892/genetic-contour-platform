#!/usr/bin/env python3
"""Independent metric verification for one experiment (requires DATABASE_URL + storage access).

Usage (from apps/api):
  set DATABASE_URL=postgresql+asyncpg://...
  set STORAGE_BACKEND=local   # or supabase/s3 with credentials
  python ../../scripts/verify_experiment_metrics.py b43cbd76-beb8-4c12-a91a-163d72abf01a
"""

from __future__ import annotations

import asyncio
import os
import sys
import uuid
from pathlib import Path

import cv2
import numpy as np
from sqlalchemy import select
from sqlalchemy.orm import selectinload

API_ROOT = Path(__file__).resolve().parents[1] / "apps" / "api"
sys.path.insert(0, str(API_ROOT))

from app.config import Settings  # noqa: E402
from app.core.supervised_metrics import compute_supervised_metrics  # noqa: E402
from app.database import AsyncSessionLocal  # noqa: E402
from app.models.algorithm_run import AlgorithmRun  # noqa: E402
from app.models.experiment import Experiment  # noqa: E402
from app.models.image import Image  # noqa: E402
from app.models.result_image import ResultImage  # noqa: E402
from app.services.storage import StorageService  # noqa: E402
from app.services.storage.exceptions import StorageObjectNotFoundError  # noqa: E402

EDGE_ALGOS = {
    "sobel": "sobel.png",
    "prewitt": "prewitt.png",
    "canny": "canny.png",
    "genetic": "genetic.png",
}


def _decode_gray(data: bytes) -> np.ndarray | None:
    return cv2.imdecode(np.frombuffer(data, dtype=np.uint8), cv2.IMREAD_GRAYSCALE)


def _counts(pred: np.ndarray, gt: np.ndarray) -> dict[str, int]:
    from app.core.supervised_metrics import _binarize, align_ground_truth

    p = _binarize(pred)
    g = align_ground_truth(gt, p.shape[:2])
    return {
        "tp": int(np.sum(p & g)),
        "fp": int(np.sum(p & ~g)),
        "fn": int(np.sum(~p & g)),
    }


async def verify(experiment_id: uuid.UUID) -> int:
    if not os.environ.get("DATABASE_URL"):
        print("ERROR: DATABASE_URL is not set")
        return 2

    settings = Settings()
    storage = StorageService(settings)

    async with AsyncSessionLocal() as session:
        result = await session.execute(
            select(Experiment)
            .where(Experiment.id == experiment_id)
            .options(
                selectinload(Experiment.algorithm_runs)
                .selectinload(AlgorithmRun.metrics),
                selectinload(Experiment.algorithm_runs)
                .selectinload(AlgorithmRun.result_images),
            )
        )
        experiment = result.scalar_one_or_none()
        if not experiment:
            print(f"ERROR: experiment {experiment_id} not found in DB")
            return 1

        img_result = await session.execute(
            select(Image).where(Image.id == experiment.image_id)
        )
        image = img_result.scalar_one_or_none()
        if not image:
            print("ERROR: source image row missing")
            return 1

        print(f"Experiment: {experiment.id} status={experiment.status}")
        print(f"Image: {image.id} storage_key={image.storage_key}")
        print(f"GT key: {image.ground_truth_storage_key}")

        missing: list[str] = []
        gt_arr: np.ndarray | None = None
        if image.ground_truth_storage_key:
            gt_key = storage.resolve_storage_key(
                storage_key=image.ground_truth_storage_key,
                file_path=image.ground_truth_file_path,
            )
            try:
                gt_bytes = storage.get_bytes(gt_key)
                gt_arr = _decode_gray(gt_bytes)
            except (StorageObjectNotFoundError, FileNotFoundError):
                missing.append(f"ground_truth | key={gt_key} | storage object not found")
        else:
            missing.append("ground_truth | key=(null) | no GT reference in DB")

        print("\nalgorithm | db_iou | recomputed_iou | diff_iou | db_f1 | recomputed_f1 | diff_f1 | verdict")

        for algo, filename in EDGE_ALGOS.items():
            run = next((r for r in experiment.algorithm_runs if r.algorithm_name == algo), None)
            if not run:
                print(f"{algo} | — | — | — | — | — | — | NO_RUN")
                continue

            m = run.metrics[0] if run.metrics else None
            db_iou = m.iou if m else None
            db_f1 = m.f1_score if m else None

            edge_type = "ga" if algo == "genetic" else algo
            ri = next((r for r in run.result_images if r.type == edge_type), None)
            if not ri or not ri.storage_key:
                missing.append(f"{algo} | key=(missing result_image type={edge_type})")
                print(f"{algo} | {db_iou} | — | — | {db_f1} | — | — | NO_ARTIFACT")
                continue

            try:
                edge_bytes = storage.get_bytes(ri.storage_key)
                edges = _decode_gray(edge_bytes)
            except (StorageObjectNotFoundError, FileNotFoundError):
                missing.append(f"{algo} | key={ri.storage_key} | storage object not found")
                print(f"{algo} | {db_iou} | — | — | {db_f1} | — | — | NO_ARTIFACT")
                continue

            if gt_arr is None or edges is None:
                print(f"{algo} | {db_iou} | — | — | {db_f1} | — | — | SKIP_NO_GT_OR_DECODE")
                continue

            recomputed = compute_supervised_metrics(edges, gt_arr)
            counts = _counts(edges, gt_arr)
            riou = recomputed["iou"]
            rf1 = recomputed["f1_score"]
            diff_iou = None if db_iou is None or riou is None else abs(db_iou - riou)
            diff_f1 = None if db_f1 is None or rf1 is None else abs(db_f1 - rf1)
            ok = (
                diff_iou is not None
                and diff_f1 is not None
                and diff_iou < 1e-9
                and diff_f1 < 1e-9
            )
            verdict = "MATCH" if ok else "MISMATCH"
            print(
                f"{algo} | {db_iou} | {riou} | {diff_iou} | {db_f1} | {rf1} | {diff_f1} | {verdict} "
                f"| TP={counts['tp']} FP={counts['fp']} FN={counts['fn']}"
            )

        if missing:
            print("\nMissing artifacts:")
            for item in missing:
                print(f"  - {item}")

    return 0


if __name__ == "__main__":
    if len(sys.argv) != 2:
        print("Usage: verify_experiment_metrics.py <experiment-uuid>")
        sys.exit(2)
    raise SystemExit(asyncio.run(verify(uuid.UUID(sys.argv[1]))))
