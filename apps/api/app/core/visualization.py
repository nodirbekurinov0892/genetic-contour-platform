"""Visualization utilities for contour detection results."""

from pathlib import Path

import cv2
import numpy as np


def save_image(image: np.ndarray, path: Path) -> str:
    path.parent.mkdir(parents=True, exist_ok=True)
    success = cv2.imwrite(str(path), image)
    if not success:
        raise OSError(f"Failed to write image to {path}")
    return str(path)


def create_overlay(original: np.ndarray, edges: np.ndarray, color: tuple = (0, 255, 0)) -> np.ndarray:
    if len(original.shape) == 2:
        base = cv2.cvtColor(original, cv2.COLOR_GRAY2BGR)
    else:
        base = original.copy()

    mask = edges > 0
    overlay = base.copy()
    overlay[mask] = (
        np.array(color, dtype=np.uint8) * 0.7 + overlay[mask] * 0.3
    ).astype(np.uint8)
    return overlay


def gradient_to_uint8(gradient: np.ndarray) -> np.ndarray:
    scaled = (gradient * 255).astype(np.uint8)
    return scaled
