"""Ground-truth artifact verification for experiment results."""

from __future__ import annotations

from typing import Any
from uuid import UUID

from app.core.scientific_evaluation import has_supervised_metrics
from app.models.experiment import Experiment
from app.models.image import Image
from app.services.storage import StorageService


def canonical_ground_truth_key(image_id: UUID) -> str:
    return f"uploads/ground-truth/{image_id}.png"


def build_gt_verification_status(
    *,
    experiment: Experiment,
    image: Image,
    storage: StorageService,
    metrics_rows: list[dict[str, Any]],
) -> dict[str, Any]:
    reproducibility = experiment.reproducibility_json or {}
    run_had_gt = bool(
        reproducibility.get("has_ground_truth")
        or reproducibility.get("ground_truth_checksum_sha256")
    )
    run_gt_checksum = reproducibility.get("ground_truth_checksum_sha256")

    db_key = (image.ground_truth_storage_key or "").strip() or None
    canonical_key = canonical_ground_truth_key(image.id)

    resolved_db_key: str | None = None
    db_file_exists = False
    if db_key:
        resolved_db_key = storage.resolve_storage_key(
            storage_key=image.ground_truth_storage_key,
            file_path=image.ground_truth_file_path,
        )
        db_file_exists = storage.exists(resolved_db_key)

    canonical_exists = storage.exists(canonical_key)

    if db_key and db_file_exists:
        storage_status = "available"
        effective_key = db_key
        file_exists = True
    elif db_key and not db_file_exists:
        storage_status = "reference_missing"
        effective_key = db_key
        file_exists = False
    elif not db_key and canonical_exists:
        storage_status = "orphan_file"
        effective_key = canonical_key
        file_exists = True
    else:
        storage_status = "not_paired"
        effective_key = None
        file_exists = False

    has_supervised = has_supervised_metrics(metrics_rows)
    inconsistent = has_supervised and not file_exists
    warning = None
    if inconsistent:
        warning = (
            "GT artifact missing; stored supervised metrics cannot be independently verified. "
            "Metrics were computed at run time when Ground Truth was available."
        )

    return {
        "image_id": str(image.id),
        "experiment_id": str(experiment.id),
        "ground_truth_storage_key": db_key,
        "canonical_ground_truth_key": canonical_key,
        "effective_ground_truth_key": effective_key,
        "ground_truth_storage_status": storage_status,
        "ground_truth_file_exists": file_exists,
        "run_time_had_ground_truth": run_had_gt,
        "run_time_ground_truth_checksum_sha256": run_gt_checksum,
        "current_gt_checksum": image.gt_checksum,
        "has_supervised_metrics": has_supervised,
        "metrics_independently_verifiable": has_supervised and file_exists,
        "inconsistency_detected": inconsistent,
        "warning": warning,
    }
