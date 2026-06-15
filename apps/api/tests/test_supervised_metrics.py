"""Numerical unit tests for supervised metric formulas."""

import numpy as np
import pytest

from app.core.supervised_metrics import compute_supervised_metrics


def _masks(pred_bits: list[int], gt_bits: list[int]) -> tuple[np.ndarray, np.ndarray]:
    pred = np.array(pred_bits, dtype=np.uint8).reshape(1, -1) * 255
    gt = np.array(gt_bits, dtype=np.uint8).reshape(1, -1) * 255
    return pred, gt


def test_standard_case_precision_recall_f1_iou_dice():
    pred, gt = _masks([1, 1, 0, 0], [1, 0, 1, 0])
    result = compute_supervised_metrics(pred, gt)

    assert result["precision"] == pytest.approx(0.5)
    assert result["recall"] == pytest.approx(0.5)
    assert result["f1_score"] == pytest.approx(0.5)
    assert result["iou"] == pytest.approx(1 / 3, rel=1e-3)
    assert result["dice_coefficient"] == pytest.approx(0.5)


def test_perfect_match():
    pred, gt = _masks([1, 1, 0], [1, 1, 0])
    result = compute_supervised_metrics(pred, gt)

    assert result["precision"] == pytest.approx(1.0)
    assert result["recall"] == pytest.approx(1.0)
    assert result["f1_score"] == pytest.approx(1.0)
    assert result["iou"] == pytest.approx(1.0)
    assert result["dice_coefficient"] == pytest.approx(1.0)


def test_no_overlap():
    pred, gt = _masks([1, 0], [0, 1])
    result = compute_supervised_metrics(pred, gt)

    assert result["precision"] == pytest.approx(0.0)
    assert result["recall"] == pytest.approx(0.0)
    assert result["f1_score"] == pytest.approx(0.0)
    assert result["iou"] == pytest.approx(0.0)
    assert result["dice_coefficient"] == pytest.approx(0.0)


def test_empty_prediction():
    pred, gt = _masks([0, 0], [1, 0])
    result = compute_supervised_metrics(pred, gt)

    assert result["precision"] is None
    assert result["recall"] == pytest.approx(0.0)
    assert result["iou"] == pytest.approx(0.0)
    assert result["dice_coefficient"] == pytest.approx(0.0)


def test_empty_ground_truth():
    pred, gt = _masks([1, 0], [0, 0])
    result = compute_supervised_metrics(pred, gt)

    assert result["precision"] == pytest.approx(0.0)
    assert result["recall"] is None
    assert result["iou"] == pytest.approx(0.0)
    assert result["dice_coefficient"] == pytest.approx(0.0)
