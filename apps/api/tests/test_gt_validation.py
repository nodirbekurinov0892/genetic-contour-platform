"""Tests for Ground Truth validation."""

import numpy as np

from app.services.gt_validation import (
    GT_DISPLAY_INVALID,
    GT_DISPLAY_WARNING,
    GT_STATUS_INVALID,
    GT_STATUS_VALID,
    validate_ground_truth_mask,
)


def test_valid_gt_mask():
    mask = np.zeros((100, 100), dtype=np.uint8)
    mask[40:60, 40:60] = 255
    result = validate_ground_truth_mask(mask, 100, 100)
    assert result["status"] == GT_STATUS_VALID
    assert result["metrics"]["foreground_coverage"] > 0


def test_invalid_gt_empty():
    mask = np.zeros((100, 100), dtype=np.uint8)
    result = validate_ground_truth_mask(mask, 100, 100)
    assert result["status"] == GT_STATUS_INVALID


def test_gt_near_aligned_warning():
    mask = np.zeros((98, 98), dtype=np.uint8)
    mask[40:58, 40:58] = 255
    result = validate_ground_truth_mask(mask, 100, 100)
    assert result["status"] == GT_STATUS_VALID
    assert result["display_status"] == GT_DISPLAY_WARNING
    assert result["metrics"]["alignment_status"] == "near_aligned"
    assert any("differ" in w for w in result["warnings"])


def test_gt_size_mismatch_invalid():
    mask = np.zeros((80, 80), dtype=np.uint8)
    mask[30:50, 30:50] = 255
    result = validate_ground_truth_mask(mask, 100, 100)
    assert result["status"] == GT_STATUS_INVALID
    assert result["display_status"] == GT_DISPLAY_INVALID
    assert result["metrics"]["alignment_status"] == "size_mismatch"
    assert any("supervised metrics require matching dimensions" in issue for issue in result["issues"])
