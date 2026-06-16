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

GT_DISPLAY_VALID = "VALID"
GT_DISPLAY_WARNING = "WARNING"
GT_DISPLAY_INVALID = "INVALID"

MIN_BINARY_COVERAGE = 0.001
MAX_BINARY_COVERAGE = 0.95
SIZE_TOLERANCE_PX = 2


def sha256_hex(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def _alignment_status(
    gt_w: int, gt_h: int, source_width: int, source_height: int
) -> str:
    if gt_w == source_width and gt_h == source_height:
        return "aligned"
    if abs(gt_w - source_width) <= SIZE_TOLERANCE_PX and abs(gt_h - source_height) <= SIZE_TOLERANCE_PX:
        return "near_aligned"
    return "size_mismatch"


def validate_ground_truth_mask(
    gt_mask: np.ndarray,
    source_width: int,
    source_height: int,
) -> dict[str, Any]:
    """Validate GT mask dimensions, binarity, coverage, corruption."""
    issues: list[str] = []
    warnings: list[str] = []

    if gt_mask is None or gt_mask.size == 0:
        return {
            "status": GT_STATUS_INVALID,
            "display_status": GT_DISPLAY_INVALID,
            "issues": ["Unable to decode ground truth mask"],
            "warnings": [],
            "metrics": {},
            "alignment_status": "corrupted",
        }

    if len(gt_mask.shape) != 2:
        issues.append(f"Expected 2D mask, got shape {gt_mask.shape}")

    h, w = gt_mask.shape[:2]
    alignment = _alignment_status(w, h, source_width, source_height)
    if alignment == "size_mismatch":
        issues.append(
            f"GT dimensions ({w}x{h}) differ from source ({source_width}x{source_height}); "
            "supervised metrics require matching dimensions"
        )
    elif alignment == "near_aligned":
        warnings.append(
            f"GT dimensions ({w}x{h}) slightly differ from source ({source_width}x{source_height})"
        )

    if not np.isfinite(gt_mask).all():
        issues.append("Corrupted mask: non-finite pixel values detected")

    unique_vals = np.unique(gt_mask[np.isfinite(gt_mask)])
    if unique_vals.size == 0:
        issues.append("Empty mask after decode")

    if len(unique_vals) > 32:
        warnings.append("Mask has many unique values; treating as soft mask via threshold at 127")

    binary = (gt_mask >= 127).astype(np.uint8)
    coverage = float(binary.mean())
    metrics = {
        "width": int(w),
        "height": int(h),
        "source_width": int(source_width),
        "source_height": int(source_height),
        "unique_values": int(len(unique_vals)),
        "foreground_coverage": round(coverage, 6),
        "foreground_ratio": round(coverage, 6),
        "foreground_pixels": int(binary.sum()),
        "total_pixels": int(binary.size),
        "alignment_status": alignment,
        "binary_valid": len(unique_vals) <= 32 or bool(set(unique_vals.tolist()) <= {0, 255}),
    }

    if coverage < MIN_BINARY_COVERAGE:
        issues.append(f"Foreground coverage too low ({coverage:.4f}) — empty mask")
    if coverage > MAX_BINARY_COVERAGE:
        issues.append(f"Foreground coverage too high ({coverage:.4f})")

    if issues:
        status = GT_STATUS_INVALID
        display_status = GT_DISPLAY_INVALID
    elif warnings:
        status = GT_STATUS_VALID
        display_status = GT_DISPLAY_WARNING
    else:
        status = GT_STATUS_VALID
        display_status = GT_DISPLAY_VALID

    return {
        "status": status,
        "display_status": display_status,
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
        "display_status": validation.get("display_status"),
        "validation_metrics": validation.get("metrics", {}),
        "recorded_at": datetime.now(timezone.utc).isoformat(),
        "lifecycle": "active",
    }


def decode_gt_from_bytes(content: bytes) -> np.ndarray | None:
    arr = cv2.imdecode(np.frombuffer(content, dtype=np.uint8), cv2.IMREAD_GRAYSCALE)
    return arr
