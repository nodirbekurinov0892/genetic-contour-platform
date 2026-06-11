"""Supervised segmentation metrics against ground-truth masks."""

from __future__ import annotations

import cv2
import numpy as np


def _binarize(mask: np.ndarray) -> np.ndarray:
    if mask.ndim == 3:
        mask = cv2.cvtColor(mask, cv2.COLOR_BGR2GRAY)
    return (mask > 127).astype(bool)


def align_ground_truth(ground_truth: np.ndarray, target_shape: tuple[int, int]) -> np.ndarray:
    """Resize and binarize GT to match prediction height x width."""
    height, width = target_shape
    if ground_truth.shape[:2] != (height, width):
        ground_truth = cv2.resize(
            ground_truth,
            (width, height),
            interpolation=cv2.INTER_NEAREST,
        )
    return _binarize(ground_truth)


def compute_supervised_metrics(
    prediction: np.ndarray,
    ground_truth: np.ndarray,
) -> dict[str, float | None]:
    pred = _binarize(prediction)
    gt = align_ground_truth(ground_truth, pred.shape[:2])

    tp = int(np.sum(pred & gt))
    fp = int(np.sum(pred & ~gt))
    fn = int(np.sum(~pred & gt))

    precision = tp / (tp + fp) if (tp + fp) > 0 else None
    recall = tp / (tp + fn) if (tp + fn) > 0 else None

    f1_score = None
    if precision is not None and recall is not None and (precision + recall) > 0:
        f1_score = 2 * precision * recall / (precision + recall)

    union = int(np.sum(pred | gt))
    iou = tp / union if union > 0 else None

    denom = int(np.sum(pred)) + int(np.sum(gt))
    dice_coefficient = (2 * tp / denom) if denom > 0 else None

    return {
        "precision": precision,
        "recall": recall,
        "f1_score": f1_score,
        "iou": iou,
        "dice_coefficient": dice_coefficient,
    }
