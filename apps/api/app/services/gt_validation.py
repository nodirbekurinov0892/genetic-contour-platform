"""Ground Truth validation, quality checks, and provenance."""

from __future__ import annotations

import hashlib
from datetime import datetime, timezone
from typing import Any

import cv2
import numpy as np

GT_STATUS_PENDING = "pending"
GT_STATUS_VALID = "valid"
GT_STATUS_INVALID = "invalid"
GT_STATUS_STALE = "stale"

MIN_BINARY_COVERAGE = 0.001
MAX_BINARY_COVERAGE = 0.95
SIZE_TOLERANCE_PX = 2


def sha256_hex(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def validate_ground_truth_mask(
    gt_mask: np.ndarray,
    source_width: int,
    source_height: int,
) -> dict[str, Any]:
    """Validate GT mask dimensions, binarity, and coverage."""
    issues: list[str] = []
    warnings: list[str] = []

    if gt_mask is None or gt_mask.size == 0:
        return {
            "status": GT_STATUS_INVALID,
            "issues": ["Unable to decode ground truth mask"],
            "warnings": [],
            "metrics": {},
        }

    if len(gt_mask.shape) != 2:
        issues.append(f"Expected 2D mask, got shape {gt_mask.shape}")

    h, w = gt_mask.shape[:2]
    if abs(w - source_width) > SIZE_TOLERANCE_PX or abs(h - source_height) > SIZE_TOLERANCE_PX:
        warnings.append(
            f"GT dimensions ({w}x{h}) differ from source ({source_width}x{source_height}); "
            "will be resized at evaluation time"
        )

    unique_vals = np.unique(gt_mask)
    if len(unique_vals) > 32:
        warnings.append("Mask has many unique values; treating as soft mask via threshold at 127")

    binary = (gt_mask >= 127).astype(np.uint8)
    coverage = float(binary.mean())
    metrics = {
        "width": int(w),
        "height": int(h),
        "unique_values": int(len(unique_vals)),
        "foreground_coverage": round(coverage, 6),
        "foreground_pixels": int(binary.sum()),
        "total_pixels": int(binary.size),
    }

    if coverage < MIN_BINARY_COVERAGE:
        issues.append(f"Foreground coverage too low ({coverage:.4f})")
    if coverage > MAX_BINARY_COVERAGE:
        issues.append(f"Foreground coverage too high ({coverage:.4f})")

    status = GT_STATUS_VALID if not issues else GT_STATUS_INVALID
    return {
        "status": status,
        "issues": issues,
        "warnings": warnings,
        "metrics": metrics,
    }


def build_gt_provenance(
    *,
    uploaded_by_user_id: str,
    original_filename: str | None,
    source_image_id: str,
    checksum: str,
    validation: dict[str, Any],
) -> dict[str, Any]:
    return {
        "uploaded_by": uploaded_by_user_id,
        "original_filename": original_filename,
        "source_image_id": source_image_id,
        "checksum_sha256": checksum,
        "validation_status": validation.get("status"),
        "validation_metrics": validation.get("metrics", {}),
        "recorded_at": datetime.now(timezone.utc).isoformat(),
        "lifecycle": "active",
    }


def decode_gt_from_bytes(content: bytes) -> np.ndarray | None:
    arr = cv2.imdecode(np.frombuffer(content, dtype=np.uint8), cv2.IMREAD_GRAYSCALE)
    return arr
