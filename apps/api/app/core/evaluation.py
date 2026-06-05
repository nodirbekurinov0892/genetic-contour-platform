"""Evaluation metrics for contour detection results."""

import cv2
import numpy as np

from app.core.genetic_algorithm.fitness import (
    _continuity_score,
    _gradient_strength_score,
    _noise_penalty,
)


def edge_density(edges: np.ndarray) -> float:
    total = edges.size
    if total == 0:
        return 0.0
    return float(np.sum(edges > 0) / total)


def compute_metrics(
    edges: np.ndarray,
    gradient: np.ndarray,
    fitness_score: float | None = None,
    runtime_ms: float | None = None,
) -> dict[str, float | int | None]:
    mask = (edges > 0).astype(np.uint8)
    return {
        "edge_density": edge_density(edges),
        "continuity_score": _continuity_score(mask),
        "noise_score": _noise_penalty(mask, gradient),
        "fitness_score": fitness_score,
        "runtime_ms": int(runtime_ms) if runtime_ms is not None else None,
    }
