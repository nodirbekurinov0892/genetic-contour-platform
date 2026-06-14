"""Reproducibility v2 — seed, checksums, git commit, lineage, dataset versioning."""

from __future__ import annotations

import hashlib
import os
import subprocess
from typing import Any

from app.core.fair_comparison import FAIR_V1_METHODOLOGY, METHODOLOGY_VERSION, resolve_protocol
from app.utils.reproducibility import capture_environment


def _git_commit_hash() -> str | None:
    try:
        result = subprocess.run(
            ["git", "rev-parse", "HEAD"],
            capture_output=True,
            text=True,
            timeout=2,
            cwd=os.path.dirname(os.path.dirname(os.path.dirname(__file__))),
        )
        if result.returncode == 0:
            return result.stdout.strip()
    except (OSError, subprocess.TimeoutExpired):
        pass
    env_hash = os.environ.get("GIT_COMMIT", "").strip()
    return env_hash or None


def sha256_hex(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def build_reproducibility_v2(
    *,
    seed: int,
    preprocessing_params: dict[str, Any] | None = None,
    algorithm_params: dict[str, Any] | None = None,
    image_dimensions: dict[str, int] | None = None,
    has_ground_truth: bool = False,
    comparison_protocol: str | None = None,
    image_checksum: str | None = None,
    gt_checksum: str | None = None,
    dataset_version: str | None = None,
    parent_experiment_id: str | None = None,
    benchmark_run_id: str | None = None,
    experiment_lineage: dict[str, Any] | None = None,
) -> dict[str, Any]:
    base = capture_environment(
        seed=seed,
        preprocessing_params=preprocessing_params,
        algorithm_params=algorithm_params,
        image_dimensions=image_dimensions,
        has_ground_truth=has_ground_truth,
    )
    protocol = resolve_protocol(comparison_protocol)
    base.update({
        "reproducibility_version": "2.0",
        "methodology_version": METHODOLOGY_VERSION,
        "comparison_protocol": protocol,
        "git_commit": _git_commit_hash(),
        "image_checksum_sha256": image_checksum,
        "ground_truth_checksum_sha256": gt_checksum,
        "dataset_version": dataset_version or "1.0",
        "parent_experiment_id": parent_experiment_id,
        "benchmark_run_id": benchmark_run_id,
        "experiment_lineage": experiment_lineage or {},
        "platform_version": "2.0.0",
    })
    if protocol == "fair_v1":
        base["fair_comparison_methodology"] = FAIR_V1_METHODOLOGY
    return base
