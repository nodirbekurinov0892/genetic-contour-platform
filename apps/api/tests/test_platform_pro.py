"""Tests for GT display status and analytics statistics."""

import numpy as np

from app.services.gt_validation import (
    GT_DISPLAY_INVALID,
    GT_DISPLAY_VALID,
    GT_DISPLAY_WARNING,
    validate_ground_truth_mask,
)


def test_gt_valid_when_aligned():
    mask = np.array([[0, 255], [0, 255]], dtype=np.uint8)
    result = validate_ground_truth_mask(mask, 2, 2)
    assert result["display_status"] == GT_DISPLAY_VALID
    assert result["metrics"]["alignment_status"] == "aligned"


def test_gt_invalid_on_size_mismatch():
    mask = np.zeros((10, 10), dtype=np.uint8)
    mask[5, 5] = 255
    result = validate_ground_truth_mask(mask, 2, 2)
    assert result["display_status"] == GT_DISPLAY_INVALID
    assert result["metrics"]["alignment_status"] == "size_mismatch"


def test_gt_invalid_on_empty_mask():
    mask = np.zeros((10, 10), dtype=np.uint8)
    result = validate_ground_truth_mask(mask, 10, 10)
    assert result["display_status"] == GT_DISPLAY_INVALID
